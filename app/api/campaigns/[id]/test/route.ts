// Send a test of this campaign's frozen snapshot to one or more addresses the
// owner controls — the "see it in a real inbox before committing" safety step.
// Sends straight through SES (no audience freeze, no campaign_recipients rows),
// with the same per-recipient unsubscribe personalization a real send uses.
//
// A test send is still real email from our SES account to any address typed
// in, so it is metered like one: it counts against the monthly quota, skips
// suppressed addresses, and is capped per user per hour.

import { NextResponse } from "next/server";
import { getCampaignForUser } from "@/db/campaigns";
import { getSendUsage, releaseSendQuota, tryReserveSendQuota } from "@/db/organizations";
import { tryConsumeRateLimit } from "@/db/rate-limits";
import { isSuppressedForOrganization } from "@/db/suppression";
import { sendEmail } from "@/lib/send/ses";
import { appBaseUrl } from "@/lib/send/qstash";
import { assertCampaignCanSend, SendRefusedError } from "@/lib/send/dispatch-campaign";
import { providerAnswered } from "@/lib/send/send-policy";
import {
  personalizeUnsubscribe,
  unsubscribeOneClickUrl,
  unsubscribePageUrl,
} from "@/lib/email/unsubscribe";
import { currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TEST_RECIPIENTS = 5;
/** Test emails one user may send per hour, across every workspace they are in. */
const TEST_SENDS_PER_HOUR = 20;

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const raw = typeof body?.email === "string" ? body.email : "";
  const emails: string[] = Array.from(
    new Set<string>(
      raw
        .split(/[,\s]+/)
        .map((e: string) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

  if (emails.length === 0) {
    return NextResponse.json({ ok: false, error: "Enter an email address" }, { status: 400 });
  }
  if (emails.length > MAX_TEST_RECIPIENTS) {
    return NextResponse.json(
      { ok: false, error: `Up to ${MAX_TEST_RECIPIENTS} test addresses at a time` },
      { status: 400 },
    );
  }
  const invalid = emails.find((e) => !EMAIL_RE.test(e));
  if (invalid) {
    return NextResponse.json({ ok: false, error: `"${invalid}" isn't a valid email` }, { status: 400 });
  }

  const campaign = await getCampaignForUser(id, userId);
  if (!campaign) {
    return NextResponse.json({ ok: false, error: "Campaign not found" }, { status: 404 });
  }

  try {
    // Tests go out through SES, which can only send as the shared address or
    // a verified domain. A Gmail campaign's From is the Gmail address, and
    // SES would reject every one of these.
    if (campaign.senderType === "mailbox") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Test sends aren't available for campaigns sent through a Gmail account yet. Send one to yourself from Gmail instead.",
        },
        { status: 400 },
      );
    }
    await assertCampaignCanSend(campaign, userId);

    const suppressed: string[] = [];
    const targets: string[] = [];
    for (const email of emails) {
      if (await isSuppressedForOrganization(campaign.organizationId, email)) suppressed.push(email);
      else targets.push(email);
    }
    if (targets.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Every address you entered is on this workspace's suppression list, so nothing was sent.",
          skipped: suppressed,
        },
        { status: 400 },
      );
    }

    if (!(await tryConsumeRateLimit(`test-send:user:${userId}`, targets.length, TEST_SENDS_PER_HOUR, 3600))) {
      return NextResponse.json(
        {
          ok: false,
          error: `You can send up to ${TEST_SENDS_PER_HOUR} test emails an hour. Try again a little later.`,
        },
        { status: 429 },
      );
    }

    if (!(await tryReserveSendQuota(campaign.organizationId, targets.length))) {
      const usage = await getSendUsage(campaign.organizationId);
      return NextResponse.json(
        {
          ok: false,
          error: `Only ${Math.max(0, usage.limit - usage.used).toLocaleString()} of your ${usage.limit.toLocaleString()} monthly emails are left, and test sends count too.`,
        },
        { status: 400 },
      );
    }

    const base = appBaseUrl();
    let sent = 0;
    let refused = 0;
    let firstError: string | null = null;
    for (const email of targets) {
      const personalized = personalizeUnsubscribe(
        { html: campaign.htmlSnapshot, text: campaign.textSnapshot },
        unsubscribePageUrl(base, userId, email),
      );
      try {
        await sendEmail({
          to: email,
          subject: `[Test] ${campaign.subject}`,
          html: personalized.html,
          text: personalized.text,
          fromName: campaign.fromName,
          fromEmail: campaign.fromEmail,
          replyTo: campaign.replyTo ?? undefined,
          listUnsubscribeUrl: unsubscribeOneClickUrl(base, userId, email),
        });
        sent++;
      } catch (err) {
        firstError ??= err instanceof Error ? err.message : "Could not send test";
        // Refund only when SES answered with an error, which proves it did
        // not take the message. A dropped connection may have been accepted.
        if (providerAnswered(err)) refused++;
      }
    }
    if (refused > 0) await releaseSendQuota(campaign.organizationId, refused);

    if (sent === 0) {
      return NextResponse.json({ ok: false, error: firstError ?? "Could not send test" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, count: sent, skipped: suppressed });
  } catch (err) {
    if (err instanceof SendRefusedError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Could not send test";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

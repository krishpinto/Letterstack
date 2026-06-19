// Send a test of this campaign's frozen snapshot to one or more addresses the
// owner controls — the "see it in a real inbox before committing" safety step.
// Sends straight through SES (no audience freeze, no campaign_recipients rows),
// with the same per-recipient unsubscribe personalization a real send uses.

import { NextResponse } from "next/server";
import { getCampaignForUser } from "@/db/campaigns";
import { sendEmail } from "@/lib/send/ses";
import { appBaseUrl } from "@/lib/send/qstash";
import {
  personalizeUnsubscribe,
  unsubscribeOneClickUrl,
  unsubscribePageUrl,
} from "@/lib/email/unsubscribe";
import { currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TEST_RECIPIENTS = 5;

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const raw = typeof body?.email === "string" ? body.email : "";
  const emails = raw
    .split(/[,\s]+/)
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) {
    return NextResponse.json({ ok: false, error: "Enter an email address" }, { status: 400 });
  }
  if (emails.length > MAX_TEST_RECIPIENTS) {
    return NextResponse.json(
      { ok: false, error: `Up to ${MAX_TEST_RECIPIENTS} test addresses at a time` },
      { status: 400 },
    );
  }
  const invalid = emails.find((e: string) => !EMAIL_RE.test(e));
  if (invalid) {
    return NextResponse.json({ ok: false, error: `"${invalid}" isn't a valid email` }, { status: 400 });
  }

  const campaign = await getCampaignForUser(id, userId);
  if (!campaign) {
    return NextResponse.json({ ok: false, error: "Campaign not found" }, { status: 404 });
  }

  const base = appBaseUrl();
  try {
    for (const email of emails) {
      const personalized = personalizeUnsubscribe(
        { html: campaign.htmlSnapshot, text: campaign.textSnapshot },
        unsubscribePageUrl(base, userId, email),
      );
      await sendEmail({
        to: email,
        subject: `[Test] ${campaign.subject}`,
        html: personalized.html,
        text: personalized.text,
        fromName: campaign.fromName,
        fromEmail: campaign.fromEmail,
        listUnsubscribeUrl: unsubscribeOneClickUrl(base, userId, email),
      });
    }
    return NextResponse.json({ ok: true, count: emails.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not send test";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

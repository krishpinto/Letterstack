import { NextResponse } from "next/server";
import { recordEvent } from "@/db/events";
import { suppressEmailForOrganization } from "@/db/suppression";
import { suppressionTargetsForEmail } from "@/db/campaign-recipients";
import { maybeAlertDeliverability } from "@/lib/notifications/campaign-notifications";
import {
  isAllowedTopic,
  isValidSubscribeUrl,
  parseSnsEnvelope,
  parseTopicAllowList,
  verifySnsMessage,
} from "@/lib/webhooks/sns";

export const runtime = "nodejs";

function reject(status: 400 | 403, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

// Logged once per instance, not per event: an unset allow-list is a
// deployment mistake to fix, and repeating it on every Delivery would bury
// everything else in the logs.
let warnedNoTopicAllowList = false;

/**
 * SES → SNS → here. Nothing in the body is trusted until the SNS signature
 * checks out, and the topic is one we subscribed to: this URL is public, and
 * an unverified Bounce or Complaint would suppress a real address in every
 * workspace that ever mailed it.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const message = parseSnsEnvelope(body);
  if (!message) return reject(400, "Not an SNS message");

  const allowList = parseTopicAllowList(process.env.SES_EVENTS_TOPIC_ARN);
  if (!isAllowedTopic(message.TopicArn, allowList)) {
    console.warn(`ses webhook: rejected message from unexpected topic ${message.TopicArn}`);
    return reject(403, "Unexpected topic");
  }

  const verification = await verifySnsMessage(message);
  if (!verification.ok) {
    console.warn(`ses webhook: rejected unverified SNS message: ${verification.reason}`);
    return reject(403, "Invalid signature");
  }

  if (allowList.length === 0 && !warnedNoTopicAllowList) {
    warnedNoTopicAllowList = true;
    console.error(
      "ses webhook: SES_EVENTS_TOPIC_ARN is not set. Signed messages from ANY SNS topic " +
        "are accepted, and subscription requests are not confirmed. Set it to the ARN of " +
        "the topic behind the SES configuration set.",
    );
  }

  if (message.Type === "SubscriptionConfirmation") {
    // A valid signature only proves SNS sent this, not that the topic is
    // ours: anyone can create a topic and subscribe this URL to it. So a
    // subscription is confirmed only when the topic is explicitly
    // allow-listed. Existing subscriptions keep working without this.
    if (allowList.length === 0) {
      console.error(
        `ses webhook: not confirming subscription to ${message.TopicArn}: ` +
          "SES_EVENTS_TOPIC_ARN is not set",
      );
      return reject(403, "Topic not allow-listed");
    }
    if (!message.SubscribeURL || !isValidSubscribeUrl(message.SubscribeURL)) {
      return reject(400, "Invalid SubscribeURL");
    }
    const confirmed = await fetch(message.SubscribeURL, {
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    }).catch(() => null);
    if (!confirmed?.ok) {
      // A 5xx makes SNS retry the confirmation instead of leaving the
      // subscription stuck pending.
      return NextResponse.json({ ok: false, error: "Confirmation failed" }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  }

  if (message.Type === "UnsubscribeConfirmation") {
    // Nothing to do: re-subscribing is a deliberate act in the AWS console.
    return NextResponse.json({ ok: true });
  }

  const event = typeof message.Message === "string" ? JSON.parse(message.Message) : null;
  const type: string = event?.eventType ?? event?.notificationType ?? "Unknown";
  const email: string | null =
    event?.bounce?.bouncedRecipients?.[0]?.emailAddress ??
    event?.complaint?.complainedRecipients?.[0]?.emailAddress ??
    event?.mail?.destination?.[0] ??
    null;
  const campaignId: string | null = event?.mail?.tags?.campaignId?.[0] ?? null;

  if (email) {
    await recordEvent(email, type, campaignId);

    if (type === "Bounce" || type === "Complaint") {
      const targets = await suppressionTargetsForEmail(email);
      await Promise.all(
        targets.map((target) =>
          suppressEmailForOrganization(
            target.organizationId,
            target.userId,
            email,
            type.toLowerCase(),
          ),
        ),
      );

      // Only on bounces and complaints, so the overwhelmingly common event
      // types (Delivery, Open, Click) never pay for the rate query. Suppression
      // happens first and unconditionally: keeping a bad address out of the
      // next send is the part that protects the account, and it must not
      // depend on a notification succeeding.
      if (campaignId) await maybeAlertDeliverability(campaignId);
    }
  }

  return NextResponse.json({ ok: true });
}

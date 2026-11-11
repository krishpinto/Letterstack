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
import { parseSesEvent } from "@/lib/webhooks/ses-event";

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

  let payload: unknown;
  try {
    payload = JSON.parse(message.Message);
  } catch {
    return reject(400, "Message is not JSON");
  }
  const event = parseSesEvent(payload);
  if (!event) return reject(400, "Message is not an SES event");

  for (const { email } of event.recipients) {
    await recordEvent(email, event.type, event.campaignId);
  }

  const toSuppress = event.recipients.filter((recipient) => recipient.suppress);
  if (toSuppress.length > 0) {
    const reason = event.type.toLowerCase();
    for (const { email } of toSuppress) {
      const targets = await suppressionTargetsForEmail(email, {
        automationId: event.automationId,
      });
      await Promise.all(
        targets.map((target) =>
          suppressEmailForOrganization(target.organizationId, target.userId, email, reason),
        ),
      );
    }
  }

  // Only on bounces and complaints, so the overwhelmingly common event types
  // (Delivery, Open, Click) never pay for the rate query. Suppression happens
  // first and unconditionally: keeping a bad address out of the next send is
  // the part that protects the account, and it must not depend on a
  // notification succeeding.
  if ((event.type === "Bounce" || event.type === "Complaint") && event.campaignId) {
    await maybeAlertDeliverability(event.campaignId);
  }

  return NextResponse.json({ ok: true });
}

import { Receiver } from "@upstash/qstash";
import { failStaleClaims, recipientStatusCounts } from "@/db/campaign-recipients";
import { markCampaignFailed, markCampaignSent } from "@/db/campaigns";
import {
  notifyCampaignFailed,
  notifyCampaignFinished,
} from "@/lib/notifications/campaign-notifications";
import { appBaseUrl, publishQstashJSON, qstashNotBefore } from "./qstash";
import { ALL_RECIPIENTS_FAILED, CLAIM_TIMEOUT_MS, decideCampaignOutcome } from "./send-policy";

/**
 * Shared by every QStash worker route (campaign-worker, gmail-campaign-worker,
 * automation-worker, scheduled-dispatch): signature verification and settling
 * the campaign's status once its recipients are done. Everything else about how
 * a worker actually sends stays route-specific — SES and Gmail need
 * different batching/retry/error handling (see the Gmail Sending plan), so
 * only this shared skeleton is factored out, not the sending itself.
 */

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

/** Verifies the QStash signature on an incoming request; returns the raw body if valid, else null. */
export async function verifyQstashRequest(request: Request): Promise<string | null> {
  const body = await request.text();
  const signature = request.headers.get("upstash-signature") ?? "";
  const isValid = await receiver.verify({ body, signature }).catch(() => false);
  return isValid ? body : null;
}

/**
 * Bring a campaign's status up to date with its recipients, and tell the
 * workspace when it is done. Every worker calls this after its batch.
 *
 * First it settles claims whose worker is gone (see CLAIM_TIMEOUT_MS), so a
 * worker that died mid-send cannot hold the campaign in "sending" forever.
 * Then, once nothing is pending or in flight, it marks the campaign sent —
 * or failed, when not one recipient could be sent to.
 *
 * The notification hangs off the guarded UPDATE's return value rather than off
 * the counts. At-least-once delivery means this runs more than once, and the
 * last few workers of a large campaign can all see the end together; only one
 * of them wins the guarded UPDATE, so only one of them mails.
 *
 * Awaited, not fire-and-forget. A serverless invocation that returns is
 * frozen, so a dangling promise here would be cancelled mid-send about as
 * often as it completed.
 */
export async function settleCampaign(campaignId: string): Promise<{ inFlight: number }> {
  await failStaleClaims(campaignId, CLAIM_TIMEOUT_MS);
  const counts = await recipientStatusCounts(campaignId);
  const outcome = decideCampaignOutcome(counts);
  if (outcome === "sent") {
    const justFinished = await markCampaignSent(campaignId);
    if (justFinished) await notifyCampaignFinished(campaignId);
  } else if (outcome === "failed") {
    const justFailed = await markCampaignFailed(campaignId, ALL_RECIPIENTS_FAILED, ["sending"]);
    if (justFailed) await notifyCampaignFailed(campaignId, ALL_RECIPIENTS_FAILED);
  }
  return { inFlight: counts.sending };
}

/**
 * Ask for settleCampaign to run again once every current claim is past
 * CLAIM_TIMEOUT_MS.
 *
 * Needed when a worker finishes and some of its own rows are still
 * "sending": a duplicate delivery is mid-send, or an earlier attempt died
 * holding them. In the second case nothing else would ever come back to
 * settle those rows, and the campaign would sit in "sending" forever.
 */
export async function scheduleSettleCheck(campaignId: string): Promise<void> {
  await publishQstashJSON({
    url: `${appBaseUrl()}/api/send/campaign-worker`,
    notBefore: qstashNotBefore(Date.now() + CLAIM_TIMEOUT_MS + 60_000),
    body: { settleOnly: true, campaignId },
  });
}

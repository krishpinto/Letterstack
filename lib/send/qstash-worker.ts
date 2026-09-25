import { Receiver } from "@upstash/qstash";
import { countPendingForCampaign } from "@/db/campaign-recipients";
import { markCampaignSent } from "@/db/campaigns";
import { notifyCampaignFinished } from "@/lib/notifications/campaign-notifications";

/**
 * Shared by every QStash worker route (campaign-worker, gmail-campaign-worker,
 * automation-worker, scheduled-dispatch): signature verification and the
 * "nothing left pending → mark sent" finalization. Everything else about how
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
 * Marks a campaign fully sent once nothing is left pending for it, and tells
 * the workspace it is done.
 *
 * The notification hangs off markCampaignSent's return value rather than off
 * the pending count. Both matter: at-least-once delivery means this runs more
 * than once for the same batch, and the last few workers of a large campaign
 * can all see pending hit zero together. Only one of them wins the guarded
 * UPDATE, so only one of them mails.
 *
 * Awaited, not fire-and-forget. A serverless invocation that returns is
 * frozen, so a dangling promise here would be cancelled mid-send about as
 * often as it completed.
 */
export async function finalizeCampaignIfDone(campaignId: string | undefined): Promise<void> {
  if (campaignId && (await countPendingForCampaign(campaignId)) === 0) {
    const justFinished = await markCampaignSent(campaignId);
    if (justFinished) await notifyCampaignFinished(campaignId);
  }
}

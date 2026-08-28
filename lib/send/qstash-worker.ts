import { Receiver } from "@upstash/qstash";
import { countPendingForCampaign } from "@/db/campaign-recipients";
import { markCampaignSent } from "@/db/campaigns";

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

/** Marks a campaign fully sent once nothing is left pending for it. */
export async function finalizeCampaignIfDone(campaignId: string | undefined): Promise<void> {
  if (campaignId && (await countPendingForCampaign(campaignId)) === 0) {
    await markCampaignSent(campaignId);
  }
}

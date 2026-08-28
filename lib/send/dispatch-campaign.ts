import { getCampaign } from "@/db/campaigns";
import { startCampaign } from "./send-campaign";
import { startGmailCampaign } from "./gmail-campaign";

/**
 * Single entry point for both "Send now" and the scheduled-dispatch worker —
 * routes to the SES path or the Gmail path based on the campaign's own
 * senderType, so neither caller has to know or duplicate that branch.
 */
export async function dispatchCampaign(campaignId: string) {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error("Campaign not found");

  if (campaign.senderType === "mailbox") {
    return startGmailCampaign(campaignId);
  }
  return startCampaign(campaignId);
}

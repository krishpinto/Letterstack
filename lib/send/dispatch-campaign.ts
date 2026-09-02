import { getCampaign } from "@/db/campaigns";
import { notifyAdminsOfCampaignSend } from "@/lib/admin-notify";
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

  const result =
    campaign.senderType === "mailbox"
      ? await startGmailCampaign(campaignId)
      : await startCampaign(campaignId);

  // After the send is committed, never before: a campaign refused for quota
  // or an empty audience throws above this line, and a notification for a
  // send that did not happen is worse than none.
  //
  // Awaited, even though nothing here needs the result: this runs in a
  // serverless function that can freeze the moment its response is returned,
  // and a floating promise would simply be dropped some of the time. The call
  // swallows its own errors, so awaiting it cannot fail the send it reports.
  await notifyAdminsOfCampaignSend(campaignId);

  return result;
}

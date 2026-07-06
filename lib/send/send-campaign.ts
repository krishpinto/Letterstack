import { isSuppressedForOrganization } from "@/db/suppression";
import { getCampaign, markCampaignSending } from "@/db/campaigns";
import {
  markCampaignRecipient,
  prepareCampaignAudience,
} from "@/db/campaign-recipients";
import { sendEmail } from "./ses";
import { appBaseUrl, publishQstashJSON } from "./qstash";
import {
  personalizeUnsubscribe,
  unsubscribeOneClickUrl,
  unsubscribePageUrl,
} from "@/lib/email/unsubscribe";

const BATCH_SIZE = 50;

export type FrozenContent = {
  subject: string;
  html: string;
  text: string;
  fromName: string;
  fromEmail: string;
};

type CampaignBatchRow = {
  id: string;
  email: string;
};

export async function sendCampaignBatch(
  content: FrozenContent,
  rows: CampaignBatchRow[],
  userId: string,
  organizationId: string,
  campaignId?: string,
) {
  let sent = 0;
  let failed = 0;
  const base = appBaseUrl();
  const tags = campaignId ? [{ name: "campaignId", value: campaignId }] : undefined;

  for (const row of rows) {
    if (await isSuppressedForOrganization(organizationId, row.email)) {
      await markCampaignRecipient(row.id, "failed", "suppressed");
      failed++;
      continue;
    }

    try {
      const personalized = personalizeUnsubscribe(
        content,
        unsubscribePageUrl(base, userId, row.email),
      );
      await sendEmail({
        to: row.email,
        subject: content.subject,
        html: personalized.html,
        text: personalized.text,
        fromName: content.fromName,
        fromEmail: content.fromEmail,
        listUnsubscribeUrl: unsubscribeOneClickUrl(base, userId, row.email),
        tags,
      });
      await markCampaignRecipient(row.id, "sent");
      sent++;
    } catch (err) {
      await markCampaignRecipient(
        row.id,
        "failed",
        err instanceof Error ? err.message : "Unknown error",
      );
      failed++;
    }
  }

  return { sent, failed };
}

export async function startCampaign(campaignId: string) {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error("Campaign not found");

  const audience = await prepareCampaignAudience(campaignId, campaign.organizationId);
  if (audience.length === 0) {
    throw new Error("Add at least one recipient before sending");
  }

  await markCampaignSending(campaignId);

  const content: FrozenContent = {
    subject: campaign.subject,
    html: campaign.htmlSnapshot,
    text: campaign.textSnapshot,
    fromName: campaign.fromName,
    fromEmail: campaign.fromEmail,
  };

  const appUrl = appBaseUrl();
  const batches = chunk(audience, BATCH_SIZE);

  await Promise.all(
    batches.map((batch) =>
      publishQstashJSON({
        url: `${appUrl}/api/send/campaign-worker`,
        body: {
          content,
          userId: campaign.userId,
          organizationId: campaign.organizationId,
          campaignId,
          campaignRecipientIds: batch.map((row) => row.id),
        },
      }),
    ),
  );

  return { total: audience.length, batches: batches.length };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }

  return out;
}

import { isSuppressedForOrganization } from "@/db/suppression";
import { getCampaign, markCampaignSending } from "@/db/campaigns";
import {
  markCampaignRecipient,
  prepareCampaignAudience,
} from "@/db/campaign-recipients";
import { BETA_EMAIL_SEND_CAP, tryReserveSendQuota } from "@/db/organizations";
import { sendEmail } from "./ses";
import { appBaseUrl, publishQstashJSON, qstashNotBefore } from "./qstash";
import {
  personalizeUnsubscribe,
  unsubscribeOneClickUrl,
  unsubscribePageUrl,
} from "@/lib/email/unsubscribe";

const BATCH_SIZE = 50;
// Matches SES's ~14/sec rate limit at 50/batch — staggering keeps concurrent
// worker invocations (and their DB connections) from piling up, which is what
// let one batch's transient failure strand its recipients as "pending"
// forever instead of a retry picking them back up.
const BATCH_STAGGER_MS = 4_000;

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
    try {
      if (await isSuppressedForOrganization(organizationId, row.email)) {
        await markCampaignRecipient(row.id, "failed", "suppressed");
        failed++;
        continue;
      }

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

  // Beta-phase hard cap on total org send volume. All-or-nothing: reserve the
  // whole batch up front so a campaign never gets cut off partway through
  // recipients arbitrarily. Reservation is atomic (a guarded UPDATE), so this
  // is also what stays correct if "Send now" and "Resume" race each other.
  const reserved = await tryReserveSendQuota(campaign.organizationId, audience.length);
  if (!reserved) {
    throw new Error(
      `Sending this would exceed the beta cap of ${BETA_EMAIL_SEND_CAP.toLocaleString()} emails for this workspace. Check Settings → Billing for remaining quota.`,
    );
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

  const now = Date.now();
  await Promise.all(
    batches.map((batch, index) =>
      publishQstashJSON({
        url: `${appUrl}/api/send/campaign-worker`,
        // First batch fires immediately; each one after waits another stagger
        // interval so worker invocations land staggered, not all at once.
        notBefore: index === 0 ? undefined : qstashNotBefore(now + index * BATCH_STAGGER_MS),
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

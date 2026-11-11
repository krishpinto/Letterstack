import { isSuppressedForOrganization } from "@/db/suppression";
import { markCampaignRecipient } from "@/db/campaign-recipients";
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
  replyTo?: string;
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
        replyTo: content.replyTo,
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

/**
 * Queue one campaign's audience as QStash batches of BATCH_SIZE, each
 * delayed one stagger interval more than the last.
 */
export async function publishSesBatches(input: {
  content: FrozenContent;
  userId: string;
  organizationId: string;
  campaignId: string;
  recipientIds: string[];
}) {
  const appUrl = appBaseUrl();
  const batches = chunk(input.recipientIds, BATCH_SIZE);

  const now = Date.now();
  await Promise.all(
    batches.map((ids, index) =>
      publishQstashJSON({
        url: `${appUrl}/api/send/campaign-worker`,
        // First batch fires immediately; each one after waits another stagger
        // interval so worker invocations land staggered, not all at once.
        notBefore: index === 0 ? undefined : qstashNotBefore(now + index * BATCH_STAGGER_MS),
        body: {
          content: input.content,
          userId: input.userId,
          organizationId: input.organizationId,
          campaignId: input.campaignId,
          campaignRecipientIds: ids,
        },
      }),
    ),
  );

  return { batches: batches.length };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }

  return out;
}

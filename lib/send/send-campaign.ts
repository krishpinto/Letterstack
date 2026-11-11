import { isSuppressedForOrganization } from "@/db/suppression";
import {
  claimCampaignRecipient,
  finishCampaignRecipient,
  returnCampaignRecipientToPending,
} from "@/db/campaign-recipients";
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

export type BatchResult = {
  sent: number;
  failed: number;
  /** Rows the provider accepted but we could not mark "sent"; see recordSent. */
  unrecorded: number;
};

/**
 * Mark a recipient "sent" after the provider accepted the message.
 *
 * The provider call cannot be undone, so the one wrong move here is turning
 * a delivered email into "failed" — that is what the old catch-all did when
 * this write threw. Instead: try twice, and if the database is still not
 * answering, leave the row "sending". Nothing will re-send it (only "pending"
 * rows are ever claimed), and settleCampaign later marks it with
 * UNKNOWN_DELIVERY_STATE.
 */
export async function recordSent(id: string): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await finishCampaignRecipient(id, "sent");
      return true;
    } catch (err) {
      console.error(`recordSent: could not mark ${id} sent (attempt ${attempt + 1})`, err);
    }
  }
  return false;
}

/**
 * Put a claimed row back to pending after a failure that happened before the
 * provider was called, then rethrow. Best-effort: if even that write fails,
 * the claim times out and the row is settled by settleCampaign.
 */
export async function releaseClaimAndThrow(id: string, err: unknown): Promise<never> {
  try {
    await returnCampaignRecipientToPending(id);
  } catch {
    // Left "sending"; the claim timeout settles it.
  }
  throw err;
}

/**
 * Send one QStash batch. Each recipient is claimed (pending → sending)
 * immediately before its own send and settled right after, so a duplicate
 * or retried delivery of the same batch skips everyone this one handled, and
 * a crash leaves at most the one in-flight row in doubt.
 */
export async function sendCampaignBatch(
  content: FrozenContent,
  recipientIds: string[],
  userId: string,
  organizationId: string,
  campaignId?: string,
): Promise<BatchResult> {
  let sent = 0;
  let failed = 0;
  let unrecorded = 0;
  const base = appBaseUrl();
  const tags = campaignId ? [{ name: "campaignId", value: campaignId }] : undefined;

  for (const id of recipientIds) {
    const row = await claimCampaignRecipient(id);
    if (!row) continue; // already handled, held by another worker, or campaign stopped

    let suppressed: boolean;
    try {
      suppressed = await isSuppressedForOrganization(organizationId, row.email);
    } catch (err) {
      return releaseClaimAndThrow(row.id, err);
    }
    if (suppressed) {
      await finishCampaignRecipient(row.id, "failed", "suppressed");
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
        replyTo: content.replyTo,
        listUnsubscribeUrl: unsubscribeOneClickUrl(base, userId, row.email),
        tags,
      });
    } catch (err) {
      await finishCampaignRecipient(
        row.id,
        "failed",
        err instanceof Error ? err.message : "Unknown error",
      );
      failed++;
      continue;
    }

    if (await recordSent(row.id)) sent++;
    else unrecorded++;
  }

  return { sent, failed, unrecorded };
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

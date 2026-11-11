import { isSuppressedForOrganization } from "@/db/suppression";
import {
  claimCampaignRecipient,
  finishCampaignRecipient,
  returnCampaignRecipientToPending,
} from "@/db/campaign-recipients";
import { sendEmail } from "./ses";
import { appBaseUrl, publishQstashJSON, qstashNotBefore } from "./qstash";
import { classifySendError, planBatches, type RecipientState } from "./send-policy";
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
 * The provider said "not now" (throttling, 5xx, a dropped connection). The
 * row that hit it is back to "pending" and the rest of the batch was never
 * claimed; the worker answers 503 so QStash retries the whole batch with
 * its own backoff, and the retry skips everyone this attempt finished.
 */
export class RetryableSendError extends Error {
  constructor(
    reason: string,
    public partial: BatchResult,
  ) {
    super(`Provider asked us to retry later: ${reason}`);
    this.name = "RetryableSendError";
  }
}

/**
 * After a provider error on a claimed row: put it back and stop the batch
 * if the error is retryable, otherwise fail just this row with the
 * provider's reason. Shared by the SES and Gmail loops.
 */
export async function settleProviderError(
  id: string,
  err: unknown,
  progress: BatchResult,
  options: { retryable?: boolean } = {},
): Promise<void> {
  const verdict = classifySendError(err);
  if (verdict.retryable || options.retryable) {
    try {
      await returnCampaignRecipientToPending(id);
    } catch {
      // Left "sending"; the claim timeout settles it. Never re-sent.
    }
    throw new RetryableSendError(verdict.reason, progress);
  }
  await finishCampaignRecipient(id, "failed", verdict.reason);
}

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
      await settleProviderError(row.id, err, { sent, failed, unrecorded });
      failed++;
      continue;
    }

    if (await recordSent(row.id)) sent++;
    else unrecorded++;
  }

  return { sent, failed, unrecorded };
}

/** How much of a dispatch round made it onto the queue. */
export type QueueResult = { queued: number; total: number };

/**
 * Queue every batch of a campaign that still has pending rows, as one
 * dispatch round. See planBatches for how batches are cut and why their
 * deduplication ids are stable within a round.
 *
 * Publishes are settled one by one rather than all-or-nothing, so the
 * caller learns how many batches are really on the queue. Calling this
 * again for the same round re-publishes only what QStash does not already
 * hold.
 */
export async function publishSesBatches(input: {
  content: FrozenContent;
  userId: string;
  organizationId: string;
  campaignId: string;
  dispatchKey: string;
  recipients: RecipientState[];
}): Promise<QueueResult> {
  const appUrl = appBaseUrl();
  const batches = planBatches({
    campaignId: input.campaignId,
    dispatchKey: input.dispatchKey,
    recipients: input.recipients,
    size: BATCH_SIZE,
    staggerMs: BATCH_STAGGER_MS,
    nowMs: Date.now(),
  });

  const results = await Promise.allSettled(
    batches.map((batch) =>
      publishQstashJSON({
        url: `${appUrl}/api/send/campaign-worker`,
        notBefore: batch.notBeforeMs === undefined ? undefined : qstashNotBefore(batch.notBeforeMs),
        deduplicationId: batch.deduplicationId,
        body: {
          content: input.content,
          userId: input.userId,
          organizationId: input.organizationId,
          campaignId: input.campaignId,
          campaignRecipientIds: batch.ids,
        },
      }),
    ),
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.error(`publishSesBatches: campaign ${input.campaignId}`, result.reason);
    }
  }

  return {
    queued: results.filter((result) => result.status === "fulfilled").length,
    total: batches.length,
  };
}

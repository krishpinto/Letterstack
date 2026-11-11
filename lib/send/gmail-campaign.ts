import {
  claimCampaignRecipient,
  finishCampaignRecipient,
  returnCampaignRecipientToPending,
} from "@/db/campaign-recipients";
import { isSuppressedForOrganization } from "@/db/suppression";
import { getMailbox, releaseMailboxQuota } from "@/db/connected-mailboxes";
import { releaseSendQuota } from "@/db/organizations";
import { getValidAccessToken, MailboxReauthRequiredError } from "./gmail-auth";
import { sendGmailMessage } from "./gmail";
import { appBaseUrl, publishQstashJSON } from "./qstash";
import {
  personalizeUnsubscribe,
  unsubscribeOneClickUrl,
  unsubscribePageUrl,
} from "@/lib/email/unsubscribe";
import {
  recordSent,
  releaseClaimAndThrow,
  releaseUnreachedQuota,
  settleProviderError,
  type FrozenContent,
  type QueueResult,
  type UnreachedTally,
} from "./send-campaign";
import {
  GMAIL_CHUNK_SIZE,
  gmailDeduplicationId,
  nextGmailChunk,
  pendingIdsInOrder,
  type RecipientState,
} from "./send-policy";

/**
 * Gmail's own send path — deliberately separate functions from
 * send-campaign.ts rather than a branch inside it. The two differ in kind,
 * not just configuration: an expired Gmail token has to halt the whole
 * batch (see MailboxReauthRequiredError below), where SES's per-recipient
 * catch-and-continue would instead mismark dozens of people "failed" for
 * what is really one problem. See the Gmail Sending plan for the full
 * reasoning.
 */

// Gmail's real constraint is roughly 1 message/second per account — a short
// gap between sends, not a batch size, since (unlike SES) there's no
// multi-message fan-out for a Gmail campaign at all; see publishGmailRun.
const SEND_GAP_MS = 1100;
const RATE_LIMIT_BACKOFF_MS = 3000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("429") || message.toLowerCase().includes("rate limit");
}

export type GmailBatchResult = {
  sent: number;
  failed: number;
  unrecorded: number;
  /** True if the run stopped early because the mailbox needs reconnecting. */
  haltedForReconnect: boolean;
};

export async function sendGmailCampaignBatch(
  content: FrozenContent,
  recipientIds: string[],
  userId: string,
  organizationId: string,
  mailboxId: string,
): Promise<GmailBatchResult> {
  const tally: UnreachedTally = { unreached: 0 };
  try {
    return await sendGmailRows(content, recipientIds, userId, organizationId, mailboxId, tally);
  } finally {
    // Both ceilings were reserved for these rows; give both back.
    await releaseUnreachedQuota(tally, async (count) => {
      await releaseMailboxQuota(mailboxId, count);
      await releaseSendQuota(organizationId, count);
    });
  }
}

async function sendGmailRows(
  content: FrozenContent,
  recipientIds: string[],
  userId: string,
  organizationId: string,
  mailboxId: string,
  tally: UnreachedTally,
): Promise<GmailBatchResult> {
  let sent = 0;
  let failed = 0;
  let unrecorded = 0;
  const base = appBaseUrl();

  const mailbox = await getMailbox(mailboxId);
  if (!mailbox) {
    // Shouldn't happen — dispatchCampaign already checked it exists — but
    // leaving everything pending is the safe failure mode either way.
    return { sent, failed, unrecorded, haltedForReconnect: false };
  }

  for (const id of recipientIds) {
    // Claimed one at a time, right before its own send — see
    // sendCampaignBatch. Matters more here: a Gmail run is long, and a
    // claim taken up front for all of it would strand every unsent row if
    // the function were killed.
    const row = await claimCampaignRecipient(id);
    if (!row) continue;

    let suppressed: boolean;
    try {
      suppressed = await isSuppressedForOrganization(organizationId, row.email);
    } catch (err) {
      return releaseClaimAndThrow(row.id, err);
    }
    if (suppressed) {
      if (await finishCampaignRecipient(row.id, "failed", "suppressed")) tally.unreached++;
      failed++;
      continue;
    }

    try {
      const personalized = personalizeUnsubscribe(
        content,
        unsubscribePageUrl(base, userId, row.email),
      );
      const sendOnce = async () => {
        const accessToken = await getValidAccessToken(mailbox);
        await sendGmailMessage(accessToken, {
          to: row.email,
          subject: content.subject,
          html: personalized.html,
          text: personalized.text,
          fromName: content.fromName,
          fromEmail: mailbox.email,
          replyTo: content.replyTo,
          listUnsubscribeUrl: unsubscribeOneClickUrl(base, userId, row.email),
        });
      };

      try {
        await sendOnce();
      } catch (err) {
        // Gmail's own rate limiter, not a rejected message — back off once
        // and retry within this invocation rather than failing the
        // recipient over a transient throttle.
        if (isRateLimitError(err)) {
          await sleep(RATE_LIMIT_BACKOFF_MS);
          await sendOnce();
        } else {
          throw err;
        }
      }
    } catch (err) {
      if (err instanceof MailboxReauthRequiredError) {
        // Not a per-recipient failure — the whole mailbox is down. Put this
        // row back and stop, leaving everything from here on "pending", so a
        // Resume after reconnecting picks up exactly where this left off
        // instead of every remaining recipient reading as a bounce.
        await returnCampaignRecipientToPending(row.id);
        return { sent, failed, unrecorded, haltedForReconnect: true };
      }
      // Still rate-limited after the backoff above, a 5xx, or a network
      // failure: the row goes back to pending and QStash retries the run.
      // Anything else fails this one recipient with Gmail's reason.
      const refused = await settleProviderError(
        row.id,
        err,
        { sent, failed, unrecorded },
        { retryable: isRateLimitError(err) },
      );
      if (refused) tally.unreached++;
      failed++;
      await sleep(SEND_GAP_MS);
      continue;
    }

    if (await recordSent(row.id)) sent++;
    else unrecorded++;
    await sleep(SEND_GAP_MS);
  }

  return { sent, failed, unrecorded, haltedForReconnect: false };
}

/**
 * One QStash message of a Gmail run: the run's full id list, where this
 * message starts in it, and the dispatch round it belongs to. Messages
 * queued before chunking existed carry neither offset nor dispatchKey, and
 * are read as offset 0 of a "legacy" round.
 */
export type GmailRunPayload = {
  content: FrozenContent;
  userId: string;
  organizationId: string;
  mailboxId: string;
  campaignId?: string;
  campaignRecipientIds: string[];
  offset?: number;
  dispatchKey?: string;
};

function publishGmailMessage(payload: GmailRunPayload & { campaignId: string; offset: number; dispatchKey: string }) {
  return publishQstashJSON({
    url: `${appBaseUrl()}/api/send/gmail-campaign-worker`,
    deduplicationId: gmailDeduplicationId(payload.campaignId, payload.dispatchKey, payload.offset),
    body: payload,
  });
}

/**
 * Queue a Gmail campaign's pending rows as a run: one QStash message for
 * the first chunk, which queues the next when it is done. No parallel
 * fan-out: Gmail's real constraint is roughly 1/sec on one account, and
 * QStash gives no guarantee against two fanned-out messages for the same
 * mailbox running concurrently, which would defeat the serial pacing.
 */
export async function publishGmailRun(input: {
  content: FrozenContent;
  userId: string;
  organizationId: string;
  mailboxId: string;
  campaignId: string;
  dispatchKey: string;
  recipients: RecipientState[];
}): Promise<QueueResult> {
  const ids = pendingIdsInOrder(input.recipients);
  if (ids.length === 0) return { queued: 0, total: 0 };

  try {
    await publishGmailMessage({
      content: input.content,
      userId: input.userId,
      organizationId: input.organizationId,
      mailboxId: input.mailboxId,
      campaignId: input.campaignId,
      campaignRecipientIds: ids,
      offset: 0,
      dispatchKey: input.dispatchKey,
    });
    return { queued: 1, total: 1 };
  } catch (err) {
    console.error(`publishGmailRun: campaign ${input.campaignId}`, err);
    return { queued: 0, total: 1 };
  }
}

/**
 * Send one chunk of a Gmail run, then queue the next chunk.
 *
 * A whole run used to be one invocation: up to 450 recipients at 1.1s or
 * more each, against a function limit of 60s, so long runs were killed
 * partway through, leaving one row stuck "sending" and the rest waiting for
 * a QStash retry that would be killed the same way. GMAIL_CHUNK_SIZE keeps
 * every invocation well inside the limit.
 *
 * The next chunk is queued after this one finishes, never before, so the
 * run stays serial. Its deduplication id depends only on where it starts,
 * so a retried chunk queues the same next message and QStash drops the
 * copy. A run halted for reconnecting queues nothing; Resume starts a new
 * run over whatever is still pending.
 */
export async function sendGmailChunk(payload: GmailRunPayload) {
  const ids = payload.campaignRecipientIds ?? [];
  const { chunk, nextOffset } = nextGmailChunk(ids, payload.offset ?? 0, GMAIL_CHUNK_SIZE);

  const result = await sendGmailCampaignBatch(
    payload.content,
    chunk,
    payload.userId,
    payload.organizationId,
    payload.mailboxId,
  );

  let continued = false;
  if (!result.haltedForReconnect && nextOffset !== null && payload.campaignId) {
    await publishGmailMessage({
      ...payload,
      campaignId: payload.campaignId,
      offset: nextOffset,
      dispatchKey: payload.dispatchKey ?? "legacy",
    });
    continued = true;
  }

  return { ...result, chunk, continued };
}

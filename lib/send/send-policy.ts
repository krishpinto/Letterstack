/**
 * The send path's decisions, kept free of I/O so they can be tested directly.
 * Everything here answers "given these facts, what should happen?"; the
 * callers in lib/send and db/ do the reading and writing.
 */

/**
 * How long a recipient may sit in "sending" before we decide the worker that
 * claimed it is gone.
 *
 * It has to be far longer than any worker can run (route maxDuration is 60s)
 * so a slow but live worker is never mistaken for a dead one. Past it, the
 * row becomes "failed" with UNKNOWN_DELIVERY_STATE rather than going back to
 * "pending": the worker may have died after the provider accepted the
 * message but before we recorded it, and re-sending would mail that person
 * twice. We choose at-most-once for these few rows, and say so in the error
 * — unless SES has reported on the message by then, which proves it went;
 * see settleStaleClaims.
 */
export const CLAIM_TIMEOUT_MS = 15 * 60 * 1000;

export const UNKNOWN_DELIVERY_STATE = "unknown delivery state";

/**
 * Minimum gap between two dispatch rounds of one campaign (the first send and
 * each Resume). Resume is safe at any time, because workers claim each
 * recipient before sending; the gap only stops a burst of clicks from
 * queueing the same pending rows several times over.
 */
export const RESUME_COOLDOWN_MS = 60_000;

export type RecipientCounts = {
  pending: number;
  sending: number;
  sent: number;
  failed: number;
};

/**
 * Whether a campaign is finished, and how. Nothing pending and nothing in
 * flight means no worker will ever touch it again. A finished campaign that
 * reached nobody is "failed", so its owner hears that it did not go out
 * rather than a cheerful "sent to 0 recipients".
 */
export function decideCampaignOutcome(
  counts: RecipientCounts,
): "in_progress" | "sent" | "failed" {
  if (counts.pending > 0 || counts.sending > 0) return "in_progress";
  if (counts.sent === 0 && counts.failed > 0) return "failed";
  return "sent";
}

export const ALL_RECIPIENTS_FAILED =
  "No recipient could be sent to. The campaign report lists each address and why.";

/** One recipient row, as the batch planner needs it. */
export type RecipientState = { id: string; status: string };

/** One QStash message's worth of recipients, and when it may run. */
export type PlannedBatch = {
  index: number;
  ids: string[];
  /** Unset for the first batch, which runs immediately. */
  notBeforeMs?: number;
  deduplicationId: string;
};

/**
 * The QStash deduplication id of one batch in one dispatch round.
 *
 * `dispatchKey` names the round (campaigns.last_dispatched_at). A retry of
 * the same round — the scheduled dispatch retried after a partial publish —
 * produces the same ids, so QStash drops the batches it already holds and
 * only the missing ones go out. A Resume starts a new round with new ids, so
 * a batch QStash gave up on can be queued again.
 *
 * QStash only remembers ids for about ten minutes. That is enough for the
 * retry case; correctness never depends on it, because workers claim every
 * row before sending (see claimCampaignRecipient).
 */
export function batchDeduplicationId(campaignId: string, dispatchKey: string, index: number) {
  return `${campaignId}-${dispatchKey}-b${index}`;
}

/** Same idea for the Gmail chain, keyed by where in the list a chunk starts. */
export function gmailDeduplicationId(campaignId: string, dispatchKey: string, offset: number) {
  return `${campaignId}-${dispatchKey}-g${offset}`;
}

/**
 * Split a campaign's recipients into QStash batches, and keep only the
 * batches that still have pending rows.
 *
 * Chunks are cut over EVERY row of the campaign, ordered by id, not over the
 * pending rows alone. Rows never join or leave a campaign once it is sending,
 * so batch N always means the same people, however much of the campaign has
 * already gone out. That is what lets a retry reuse batch N's
 * deduplication id safely: cutting over pending rows would shift every
 * chunk after the first finished one, and an id QStash already holds would
 * silently swallow a batch of different people.
 *
 * Each kept batch carries only its pending ids, and is delayed one stagger
 * interval more than the one before it, so worker invocations land spread
 * out. The first one runs immediately.
 */
export function planBatches(input: {
  campaignId: string;
  dispatchKey: string;
  recipients: RecipientState[];
  size: number;
  staggerMs: number;
  nowMs: number;
}): PlannedBatch[] {
  const ordered = [...input.recipients].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const out: PlannedBatch[] = [];

  for (let start = 0, index = 0; start < ordered.length; start += input.size, index++) {
    const ids = ordered
      .slice(start, start + input.size)
      .filter((row) => row.status === "pending")
      .map((row) => row.id);
    if (ids.length === 0) continue;

    const position = out.length;
    out.push({
      index,
      ids,
      notBeforeMs: position === 0 ? undefined : input.nowMs + position * input.staggerMs,
      deduplicationId: batchDeduplicationId(input.campaignId, input.dispatchKey, index),
    });
  }

  return out;
}

/** The pending ids of a campaign, in the same stable order planBatches uses. */
export function pendingIdsInOrder(recipients: RecipientState[]): string[] {
  return recipients
    .filter((row) => row.status === "pending")
    .map((row) => row.id)
    .sort();
}

// Provider errors that say "not now" rather than "never". SES's own names
// (ThrottlingException, TooManyRequestsException for the per-second rate,
// LimitExceededException for the daily quota, SendingPausedException while
// the account is paused) plus the AWS SDK's generic server-side ones.
const RETRYABLE_ERROR_NAMES = new Set([
  "Throttling",
  "ThrottlingException",
  "TooManyRequestsException",
  "LimitExceededException",
  "SendingPausedException",
  "ServiceUnavailable",
  "ServiceUnavailableException",
  "InternalFailure",
  "InternalServiceErrorException",
  "RequestTimeout",
  "RequestTimeoutException",
  "TimeoutError",
]);

// Node and undici network failures: the request may never have left.
const RETRYABLE_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "EAI_AGAIN",
  "ENOTFOUND",
  "ENETUNREACH",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
]);

export type SendErrorVerdict = { retryable: boolean; reason: string };

/**
 * Whether a provider error is worth trying again later, for SES and Gmail
 * alike.
 *
 * Retryable: throttling, 429, any 5xx, and network failures. The row goes
 * back to "pending" and QStash retries the batch with its own backoff, so a
 * busy minute at SES no longer fails recipients for good.
 *
 * Permanent: everything else — MessageRejected, an unverified sending
 * identity, a malformed address, any other 4xx. The row is failed with the
 * provider's message, which is what the campaign report shows.
 *
 * A timeout can in rare cases come after the provider accepted the message,
 * so retrying it can duplicate one email. The AWS SDK already retries these
 * internally on the same terms; we accept the same trade-off one level up
 * rather than failing a recipient over a dropped connection.
 */
export function classifySendError(err: unknown): SendErrorVerdict {
  const e = (err ?? {}) as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    status?: unknown;
    $retryable?: unknown;
    $metadata?: { httpStatusCode?: unknown };
    response?: { status?: unknown };
  };
  const name = typeof e.name === "string" ? e.name : "";
  const message = typeof e.message === "string" && e.message ? e.message : name || "Unknown error";

  const status = [e.$metadata?.httpStatusCode, e.status, e.response?.status, e.code].find(
    (value): value is number => typeof value === "number",
  );

  const retryable =
    RETRYABLE_ERROR_NAMES.has(name) ||
    Boolean(e.$retryable) ||
    (typeof e.code === "string" && RETRYABLE_ERROR_CODES.has(e.code)) ||
    status === 429 ||
    (status !== undefined && status >= 500);

  return { retryable, reason: message };
}

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
 * twice. We choose at-most-once for these few rows, and say so in the error.
 */
export const CLAIM_TIMEOUT_MS = 15 * 60 * 1000;

export const UNKNOWN_DELIVERY_STATE = "unknown delivery state";

export type RecipientCounts = {
  pending: number;
  sending: number;
  sent: number;
  failed: number;
};

/**
 * Whether a campaign is finished, and how. Nothing pending and nothing in
 * flight means no worker will ever touch it again.
 */
export function decideCampaignOutcome(counts: RecipientCounts): "in_progress" | "sent" {
  if (counts.pending > 0 || counts.sending > 0) return "in_progress";
  return "sent";
}

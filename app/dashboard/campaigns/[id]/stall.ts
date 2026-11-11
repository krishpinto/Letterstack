// When does a live send count as "stalled"?
//
// The only client-side signal is that the number of finished recipients
// (sent + failed) stops moving while some are still pending. That alone is
// not enough: QStash retries a failed batch with backoff that runs into
// minutes, so a 45-second pause is normal and offering "Resume" then only
// invites a second dispatch. A send is stalled after STALL_THRESHOLD_MS with
// no progress at all.

export const STALL_THRESHOLD_MS = 5 * 60_000;

export type StallTracker = { done: number; since: number } | null;

export type ProgressCounts = {
  sent: number;
  failed: number;
  pending: number;
};

export function trackStall(
  tracker: StallTracker,
  progress: ProgressCounts,
  now: number,
  thresholdMs = STALL_THRESHOLD_MS,
): { tracker: StallTracker; stalled: boolean } {
  const done = progress.sent + progress.failed;
  if (tracker === null || tracker.done !== done) {
    return { tracker: { done, since: now }, stalled: false };
  }
  return {
    tracker,
    stalled: progress.pending > 0 && now - tracker.since >= thresholdMs,
  };
}

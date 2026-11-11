// What the editor may upload, and how often.
//
// Image types are the ones email clients actually render. SVG is left out on
// purpose: Gmail and Outlook don't display it, so an SVG upload only ever
// produced a broken image in the inbox, and it's a scriptable format we'd be
// hosting on our CDN account for no benefit.

export const EMAIL_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;

/** For the file picker's `accept`, so the browser filters to the same list. */
export const EMAIL_IMAGE_ACCEPT = EMAIL_IMAGE_TYPES.join(",");

/**
 * Per-user upload rate: enough for building a long newsletter image by
 * image, far short of using the account as free bulk storage.
 */
export const UPLOAD_WINDOW_MS = 10 * 60 * 1000;
export const UPLOAD_MAX_PER_WINDOW = 40;

/**
 * Sliding-window counter keyed by user. Returns a function that records an
 * attempt and reports whether it is over the limit.
 *
 * Best-effort, like the API burst guard in lib/api/with-api-key.ts:
 * serverless instances don't share memory, so this blunts a loop hitting one
 * warm instance rather than enforcing an exact global cap. A durable limiter
 * can replace it behind the same call without touching the router.
 */
export function createSlidingWindowLimiter(windowMs: number, max: number) {
  const hits = new Map<string, number[]>();
  return function limited(key: string, now = Date.now()): boolean {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent);
      return true;
    }
    recent.push(now);
    hits.set(key, recent);
    return false;
  };
}

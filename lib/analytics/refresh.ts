// How often an analytics page refreshes itself, and how it says when it last
// did. Pure so the timing rules are testable without a browser.
//
// The per-campaign page used to poll every 1.5s while a send was in flight
// and then stop for good, so delivery, bounce and open events that arrive
// over the following minutes and hours never showed up without a manual
// reload. Now it polls fast while the send is live and slowly afterwards.

/** While recipients are still being handed to SES. */
export const LIVE_REFRESH_MS = 3_000;
/** After the send: events keep arriving for hours, but slowly. */
export const IDLE_REFRESH_MS = 60_000;

export function refreshDelay(live: boolean): number {
  return live ? LIVE_REFRESH_MS : IDLE_REFRESH_MS;
}

/** "Updated just now" / "Updated 3 min ago" / "Updated 2 h ago". */
export function formatUpdatedAgo(updatedAt: number | null, now: number): string {
  if (updatedAt === null) return "Not updated yet";
  const seconds = Math.max(0, Math.floor((now - updatedAt) / 1000));
  if (seconds < 45) return "Updated just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Updated ${hours} h ago`;
  const days = Math.round(hours / 24);
  return `Updated ${days} d ago`;
}

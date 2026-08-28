import { PLAN_LIMITS, type PlanKey } from "@/lib/plans/limits";

/**
 * One plan notice, in the shape every surface that shows it needs.
 *
 * The top banner and the notifications bell say the same thing in two
 * places, so the copy is derived once here rather than written twice. The
 * banner can be dismissed; the bell keeps it either way, which is the whole
 * point — closing the bar shouldn't lose the fact that the plan is ending.
 */
export type PlanNotice = {
  /**
   * Stable for one period, distinct across periods. Dismissal is recorded
   * against this, so closing "ends in 14 days" stays closed for the whole
   * run-up, but a renewal (new expiry date) or the plan actually lapsing
   * produces a different id and speaks up again.
   */
  id: string;
  kind: "expiring" | "ended";
  title: string;
  body: string;
  actionLabel: string;
  actionHref: string;
};

/** The settings page reads ?section=, not ?tab=. */
const BILLING_HREF = "/dashboard/settings?section=billing";

/**
 * Dismissal lives in a cookie, not localStorage, so the server layout can
 * read it and render nothing at all. Deciding on the client would mean
 * shipping the bar in the HTML and yanking it after hydration — a visible
 * flash and a layout shift on every page load.
 */
export const PLAN_NOTICE_DISMISSED_COOKIE = "ls_plan_notice_dismissed";

/** Explicit locale: this is formatted on the server and hydrated on the
 *  client, and an implicit one can differ between the two. */
function formatDay(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

export function planNotice(state: {
  plan: PlanKey;
  isTrial: boolean;
  trialEnded: boolean;
  isExpiringSoon: boolean;
  daysLeft: number | null;
  expiresAt: Date | string | null;
}): PlanNotice | null {
  const expiresAt = state.expiresAt ? new Date(state.expiresAt) : null;
  const stamp = expiresAt ? expiresAt.toISOString().slice(0, 10) : "unknown";

  if (state.trialEnded) {
    return {
      id: `ended:${stamp}`,
      kind: "ended",
      // The tier that ended isn't knowable here — the plan has already
      // resolved to free — so this stays deliberately unnamed.
      title: "Your paid plan has ended.",
      body: "Your workspace is on the Free plan — everything you’ve made is still here, but sending and contact limits are lower.",
      actionLabel: "See plans",
      actionHref: BILLING_HREF,
    };
  }

  if (!state.isExpiringSoon || state.daysLeft === null) return null;

  const current = PLAN_LIMITS[state.plan];
  // "tomorrow" and "today" read as urgent in a way "in 1 days" never does.
  const when =
    state.daysLeft === 0
      ? "today"
      : state.daysLeft === 1
        ? "tomorrow"
        : `in ${state.daysLeft} days`;
  const until = expiresAt && state.daysLeft > 1 ? ` (${formatDay(expiresAt)})` : "";

  return {
    id: `expiring:${state.plan}:${stamp}`,
    kind: "expiring",
    title: `Your ${current.label} plan ends ${when}${until}.`,
    // Prices come from the plan table, so a tier's rate can't be quoted here
    // at last month's number — and a negotiated tier, which has no list price
    // to quote, falls through to the neutral wording.
    body:
      state.isTrial &&
      current.monthlyPrice !== null &&
      current.yearlyPrice !== null
        ? `Continue on ${current.label} for ₹${current.monthlyPrice.toLocaleString("en-IN")} a month, or ₹${current.yearlyPrice.toLocaleString("en-IN")} a year.`
        : "Renew to keep your current limits.",
    actionLabel: state.isTrial ? `Continue on ${current.label}` : "Renew",
    actionHref: BILLING_HREF,
  };
}

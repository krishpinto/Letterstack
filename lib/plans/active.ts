// Which plan a workspace is actually on at a given moment.
//
// Pure, with `now` passed in, so the database layer, the checkout quote and
// the tests all resolve "is this period still running" the same way. The
// stored `plan` alone isn't enough: a paid period that has run out reads as
// free everywhere, without a cron job sweeping expired rows.

import { normalizePlan, type PlanKey } from "./limits";

export type StoredPlan = {
  plan?: string | null;
  planExpiresAt?: Date | string | null;
};

export function activePlanAt(org: StoredPlan, now: Date): PlanKey {
  // normalizePlan collapses anything unrecognised to free, so a typo or a
  // hand-edited row can only ever be less permissive than intended.
  const plan = normalizePlan(org.plan);
  if (plan === "free") return "free";
  // A null expiry is "still running": an admin grant with no end date, or a
  // trial whose clock hasn't started yet.
  if (!org.planExpiresAt) return plan;
  return new Date(org.planExpiresAt).getTime() > now.getTime() ? plan : "free";
}

// How many more workspaces one person may own.
//
// Pure, with `now` passed in, so the rule can be tested without a database.

import { activePlanAt, type StoredPlan } from "./active";
import { higherPlan, PLAN_LIMITS, type PlanKey } from "./limits";

export type Membership = StoredPlan & { role: string };

/**
 * Whether someone with these memberships may create another workspace.
 *
 * Counts only workspaces they own, against the best plan among those. It
 * used to count every membership against the best plan of any workspace
 * they belonged to, so being invited into someone's Growth workspace let a
 * person create five Free ones of their own, and being a member of a Free
 * one used up the only slot they had.
 */
export function workspaceAllowance(
  memberships: Membership[],
  now: Date,
): { ok: boolean; owned: number; allowance: number; plan: PlanKey } {
  const owned = memberships.filter((m) => m.role === "owner");
  const plan = owned.reduce<PlanKey>(
    (best, org) => higherPlan(best, activePlanAt(org, now)),
    "free",
  );
  const allowance = PLAN_LIMITS[plan].workspaces;
  return { ok: owned.length < allowance, owned: owned.length, allowance, plan };
}

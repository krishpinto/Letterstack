// The plan's signup-form allowance, checked when a form is created.
//
// Only creation is limited. A workspace that downgrades keeps every form it
// already has, and those forms keep collecting signups: switching off a
// form that is live on someone's website would silently lose their
// subscribers, which is worse for everyone than an extra form.

import { limitMessage, limitsFor, type PlanKey } from "@/lib/plans/limits";

/** Why one more form can't be created, or null when it can. */
export function signupFormLimitProblem(plan: PlanKey, existingForms: number): string | null {
  if (existingForms < limitsFor(plan).signupForms) return null;
  return limitMessage("signupForms", plan);
}

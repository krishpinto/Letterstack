// What each plan actually allows.
//
// One table, read everywhere a limit is enforced, so a tier's numbers can
// never disagree between the pricing page, the settings meters, and the
// check that actually blocks an action.
//
// Limits are enforced at the barrier the user walks into — importing past
// the contact ceiling, sending past the monthly allowance — rather than as a
// global lock on the account. Someone whose trial lapsed keeps their lists,
// drafts, and history; they're stopped at the specific thing that costs
// money, and told exactly why.

export type PlanKey = "free" | "pro";

export type PlanLimits = {
  label: string;
  /** Recipients that may exist in the workspace at once. */
  contacts: number;
  /** Marketing emails per calendar month. Transactional mail doesn't count. */
  emailsPerMonth: number;
  /** Verified sending domains. */
  domains: number;
  /**
   * Workspaces one person may own. Capped because every workspace carries
   * its own allowances — without a ceiling, ten Free workspaces add up to
   * more monthly sending than the paid tier they'd otherwise buy.
   */
  workspaces: number;
};

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  free: {
    label: "Free",
    contacts: 500,
    emailsPerMonth: 2_000,
    domains: 1,
    workspaces: 1,
  },
  // "pro" is the Starter tier on the pricing page. A second paid tier would
  // be added here as its own key rather than by widening these numbers.
  pro: {
    label: "Starter",
    contacts: 3_000,
    emailsPerMonth: 15_000,
    domains: 2,
    workspaces: 3,
  },
};

export function limitsFor(plan: PlanKey | string): PlanLimits {
  return plan === "pro" ? PLAN_LIMITS.pro : PLAN_LIMITS.free;
}

/**
 * The message shown at a barrier. Deliberately states the number, the tier,
 * and the way out — a bare "limit reached" makes someone go hunting for
 * which limit and what to do about it.
 */
export function limitMessage(
  what: "contacts" | "emails" | "domains" | "workspaces",
  plan: PlanKey | string,
  attempted?: number,
): string {
  const limits = limitsFor(plan);
  const onFree = plan !== "pro";
  const upgrade = onFree
    ? "Upgrade to Starter for more — see Settings → Billing."
    : "Contact us if you need a higher limit.";

  switch (what) {
    case "contacts": {
      const over = attempted !== undefined ? ` You tried to go to ${attempted.toLocaleString()}.` : "";
      return `${limits.label} plans include ${limits.contacts.toLocaleString()} contacts.${over} ${upgrade}`;
    }
    case "emails":
      return `${limits.label} plans include ${limits.emailsPerMonth.toLocaleString()} emails a month, and this send would go past that. ${upgrade}`;
    case "domains":
      return `${limits.label} plans include ${limits.domains} sending domain${limits.domains === 1 ? "" : "s"}. ${upgrade}`;
    case "workspaces":
      return (
        `${limits.label} plans include ${limits.workspaces} workspace${limits.workspaces === 1 ? "" : "s"}. ` +
        `Your existing workspaces aren't affected — you just can't add another. ${upgrade}`
      );
  }
}

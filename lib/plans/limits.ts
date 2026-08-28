// What each plan allows, and what it costs.
//
// One table, read everywhere a limit is enforced AND everywhere a plan is
// advertised, so a tier's numbers can never disagree between the pricing
// page, the settings meters, and the check that actually blocks an action.
// The pricing page used to hardcode its own copy of these figures, which is
// exactly how it came to advertise a tier the rest of the app had never
// heard of.
//
// Limits are enforced at the barrier the user walks into — importing past
// the contact ceiling, sending past the monthly allowance — rather than as a
// global lock on the account. Someone whose plan lapsed keeps their lists,
// drafts, and history; they're stopped at the specific thing that costs
// money, and told exactly why.

export type PlanKey = "free" | "pro" | "growth" | "business";

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

  // ── Presentation. Read by the pricing page and the billing panel. ──

  /** Ascending. Defines "next tier up" and which plan wins when two apply. */
  rank: number;
  /** One line on the pricing card, under the tier name. */
  blurb: string;
  /** Rupees per month / per year. Null on tiers that aren't self-serve. */
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  /**
   * True when the figures above are a starting point to negotiate from
   * rather than a fixed ceiling. Drives the "+" on the pricing card and the
   * talk-to-us CTA. The numbers are still enforced — they're what an admin
   * provisions by default — so this tier can never read as "unlimited".
   */
  negotiable?: boolean;
  /** Features that aren't a number in this table. */
  extras: string[];
};

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  free: {
    label: "Free",
    contacts: 500,
    emailsPerMonth: 2_000,
    domains: 1,
    workspaces: 1,
    rank: 0,
    blurb: "Enough to run a real list and see whether this fits you.",
    monthlyPrice: 0,
    yearlyPrice: 0,
    extras: ["1 signup form", "7 days of analytics", "Full block editor"],
  },
  // "pro" is the Starter tier everywhere it's shown. The stored plan value
  // stays "pro" because live rows and settled payments already carry it —
  // renaming the key would need a data migration to buy nothing.
  pro: {
    label: "Starter",
    contacts: 3_000,
    emailsPerMonth: 15_000,
    domains: 2,
    workspaces: 3,
    rank: 1,
    blurb: "For a newsletter going out to a few thousand people.",
    monthlyPrice: 499,
    yearlyPrice: 4_999,
    extras: ["Unlimited signup forms", "Full analytics history", "Email support"],
  },
  growth: {
    label: "Growth",
    contacts: 10_000,
    emailsPerMonth: 50_000,
    domains: 5,
    workspaces: 5,
    rank: 2,
    blurb: "For orgs sending to a larger list, more than once a month.",
    monthlyPrice: 1_499,
    yearlyPrice: 14_999,
    extras: [
      "Team roles and invites",
      "Full analytics history",
      "Priority support",
    ],
  },
  // Deliberately not self-serve. Above Growth the cost of a bad list stops
  // being ours to absorb: one sender importing a bought list can push the
  // whole SES account past the 10% bounce / 0.5% complaint thresholds and
  // take every other customer's sending down with it. A conversation before
  // the first send is the cheapest protection we have, so this tier routes
  // to the contact form rather than to a checkout button.
  business: {
    label: "Business",
    contacts: 25_000,
    emailsPerMonth: 150_000,
    domains: 10,
    workspaces: 10,
    rank: 3,
    blurb: "For high-volume senders who need room past Growth.",
    monthlyPrice: null,
    yearlyPrice: null,
    negotiable: true,
    extras: [
      "Deliverability review before your first send",
      "Help migrating and warming your list",
      "Dedicated sending domain setup",
      "Direct line to the founders",
    ],
  },
};

/** Every tier, cheapest first. The pricing page renders in this order. */
export const PLAN_ORDER: PlanKey[] = (
  Object.keys(PLAN_LIMITS) as PlanKey[]
).sort((a, b) => PLAN_LIMITS[a].rank - PLAN_LIMITS[b].rank);

/** The paid tiers, cheapest first. Free is the absence of one of these. */
export const PAID_PLAN_KEYS: PlanKey[] = PLAN_ORDER.filter(
  (key) => key !== "free",
);

export function isPlanKey(plan: unknown): plan is PlanKey {
  return (
    typeof plan === "string" &&
    Object.prototype.hasOwnProperty.call(PLAN_LIMITS, plan)
  );
}

/**
 * A stored plan string as a known tier. Anything unrecognised reads as free,
 * so a typo or a hand-edited row can only ever be less permissive.
 */
export function normalizePlan(plan: unknown): PlanKey {
  return isPlanKey(plan) ? plan : "free";
}

export function limitsFor(plan: PlanKey | string): PlanLimits {
  return PLAN_LIMITS[normalizePlan(plan)];
}

export function planRank(plan: PlanKey | string): number {
  return limitsFor(plan).rank;
}

/** Whichever of two plans allows more. Used when one person holds several. */
export function higherPlan(a: PlanKey | string, b: PlanKey | string): PlanKey {
  return planRank(a) >= planRank(b) ? normalizePlan(a) : normalizePlan(b);
}

/** The next tier up, or null at the top. Drives every "upgrade" prompt. */
export function nextPlanUp(plan: PlanKey | string): PlanKey | null {
  const rank = planRank(plan);
  return PLAN_ORDER.find((key) => PLAN_LIMITS[key].rank > rank) ?? null;
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
  const next = nextPlanUp(plan);
  // At the top tier there is nothing left to sell them, so the way out is us.
  const upgrade = next
    ? `Upgrade to ${PLAN_LIMITS[next].label} for more — see Settings → Billing.`
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

/**
 * The quota bullets shown on a pricing card, built from the enforced numbers
 * so the marketing copy cannot drift from what the code actually allows.
 */
export function planHighlights(plan: PlanKey): string[] {
  const limits = PLAN_LIMITS[plan];
  const plus = limits.negotiable ? "+" : "";
  return [
    `${limits.contacts.toLocaleString("en-IN")}${plus} contacts`,
    `${limits.emailsPerMonth.toLocaleString("en-IN")}${plus} emails a month`,
    `${limits.domains}${plus} sending domain${limits.domains === 1 ? "" : "s"}`,
    ...limits.extras,
  ];
}

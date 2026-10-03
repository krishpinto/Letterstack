// What can actually be bought, and for how much.
//
// Prices live here, on the server, and are looked up by key — the browser
// sends "which item", never "how much". A client that could name its own
// amount could pay ₹1 for anything, and no amount of signature checking
// downstream would catch it, because the signature would be perfectly valid
// for the cheap order it asked for.
//
// Amounts are duplicated from lib/plans/limits.ts on purpose — that table is
// what a tier promises, this one is what we charge, and a price change has to
// be a deliberate edit here rather than something a marketing tweak can do by
// accident. The pricing page reads the limits table; checkout reads this one;
// the assertion at the bottom fails the build if the two ever disagree.
//
// Business has no entry: it is quoted per deal and provisioned by an admin
// grant, so there is deliberately nothing here for a browser to buy.

import { PLAN_LIMITS, PLAN_ORDER, type PlanKey } from "@/lib/plans/limits";

export type PaymentItemKey = keyof typeof PAYMENT_ITEMS;

export const PAYMENT_ITEMS = {
  internal_test: {
    /** Paise. Razorpay's floor is 100 (₹1). */
    amount: 100,
    currency: "INR",
    label: "Internal test payment",
    description: "LetterStack test payment",
    /** Founder-only: beta workspaces must not be able to buy this. */
    adminOnly: true,
    /** No entitlement — this one only proves the rail works. */
    grantsPlan: null,
    planDays: 0,
  },
  pro_monthly: {
    amount: 100_000,
    currency: "INR",
    label: "Pro — 1 month",
    description: "LetterStack Pro (1 month)",
    adminOnly: false,
    grantsPlan: "pro",
    planDays: 30,
  },
  // Ten months' price for twelve. yearlyPricing() in lib/plans/limits.ts
  // derives the crossed-out list price from that same ratio, so the discount
  // shown on the pricing card and the amount charged here can't disagree.
  //
  // Annual runs on the one-time payment rail — no mandate, no Razorpay
  // Subscriptions — which is why it's the option worth steering people toward
  // until recurring billing exists.
  pro_yearly: {
    amount: 1_000_000,
    currency: "INR",
    label: "Pro — 12 months",
    description: "LetterStack Pro (1 year)",
    adminOnly: false,
    grantsPlan: "pro",
    planDays: 365,
  },
  growth_monthly: {
    amount: 250_000,
    currency: "INR",
    label: "Growth — 1 month",
    description: "LetterStack Growth (1 month)",
    adminOnly: false,
    grantsPlan: "growth",
    planDays: 30,
  },
  growth_yearly: {
    amount: 2_500_000,
    currency: "INR",
    label: "Growth — 12 months",
    description: "LetterStack Growth (1 year)",
    adminOnly: false,
    grantsPlan: "growth",
    planDays: 365,
  },
  // The ₹5 item the rail was first proven with. Kept, founder-only, so the
  // live payment path can still be exercised end to end without spending
  // a month's subscription each time.
  pro_smoke_test: {
    amount: 500,
    currency: "INR",
    label: "Pro — smoke test",
    description: "LetterStack Pro (test purchase)",
    adminOnly: true,
    grantsPlan: "pro",
    planDays: 30,
  },
} as const;

export function getPaymentItem(key: string) {
  if (!Object.prototype.hasOwnProperty.call(PAYMENT_ITEMS, key)) return null;
  return PAYMENT_ITEMS[key as PaymentItemKey];
}

/**
 * The two things a workspace can buy to get onto `plan`, or null when that
 * tier isn't self-serve. Lets the billing panel offer any tier without
 * knowing the item keys by hand.
 */
export function checkoutItemsFor(
  plan: PlanKey,
): { monthly: PaymentItemKey; yearly: PaymentItemKey } | null {
  if (plan === "pro") return { monthly: "pro_monthly", yearly: "pro_yearly" };
  if (plan === "growth") {
    return { monthly: "growth_monthly", yearly: "growth_yearly" };
  }
  return null;
}

/**
 * What to call this purchase in front of a customer.
 *
 * Derived from the plan table rather than read off the item's own `description`
 * string, because those strings were written when the paid tier was called Pro
 * and kept saying so after it was renamed to Starter — so the checkout modal
 * and the invoice both advertised a plan name that appears nowhere else in the
 * product. The stored key is still `pro` (live rows and settled payments carry
 * it), and that's exactly why the display name can't be inferred from it.
 *
 * `description` survives for the items that grant no plan and so have no label
 * to borrow.
 */
export function itemDisplayName(key: PaymentItemKey | string): string {
  const item = getPaymentItem(key);
  if (!item) return "LetterStack subscription";
  if (!item.grantsPlan) return item.description;

  const label = PLAN_LIMITS[item.grantsPlan as PlanKey].label;
  const period =
    item.planDays >= 365
      ? "1 year"
      : item.planDays >= 28
        ? "1 month"
        : `${item.planDays} days`;
  return `LetterStack ${label} (${period})`;
}

// Fails at import time — so in the build, not in front of a customer — if an
// advertised price ever stops matching the amount actually charged. Paise, so
// the comparison is exact: no float rounding to explain away.
for (const plan of PLAN_ORDER) {
  const items = checkoutItemsFor(plan);
  const limits = PLAN_LIMITS[plan];
  if (!items) {
    if (limits.monthlyPrice !== null && plan !== "free") {
      throw new Error(`Plan "${plan}" advertises a price but cannot be bought`);
    }
    continue;
  }
  const expected: Array<[PaymentItemKey, number | null]> = [
    [items.monthly, limits.monthlyPrice],
    [items.yearly, limits.yearlyPrice],
  ];
  for (const [key, rupees] of expected) {
    if (rupees === null) {
      throw new Error(`Plan "${plan}" is purchasable but advertises no price`);
    }
    if (PAYMENT_ITEMS[key].amount !== rupees * 100) {
      throw new Error(
        `Price drift: ${key} charges ${PAYMENT_ITEMS[key].amount} paise, ` +
          `but the ${plan} plan advertises ₹${rupees}`,
      );
    }
  }
}

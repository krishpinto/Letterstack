// What can actually be bought, and for how much.
//
// Prices live here, on the server, and are looked up by key — the browser
// sends "which item", never "how much". A client that could name its own
// amount could pay ₹1 for anything, and no amount of signature checking
// downstream would catch it, because the signature would be perfectly valid
// for the cheap order it asked for.
//
// There's no plan/pricing model yet, so this holds one internal entry. When
// real plans land, they get added here and nothing else about the payment
// path has to change.

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
    amount: 49_900,
    currency: "INR",
    label: "Pro — 1 month",
    description: "LetterStack Pro (1 month)",
    adminOnly: false,
    grantsPlan: "pro",
    planDays: 30,
  },
  // Ten months' price for twelve. Annual also runs on the one-time payment
  // rail — no mandate, no Razorpay Subscriptions — which is why it's the
  // option worth steering people toward until recurring billing exists.
  pro_yearly: {
    amount: 499_900,
    currency: "INR",
    label: "Pro — 12 months",
    description: "LetterStack Pro (1 year)",
    adminOnly: false,
    grantsPlan: "pro",
    planDays: 365,
  },
  // The ₹5 item the rail was first proven with. Kept, founder-only, so the
  // live payment path can still be exercised end to end without spending
  // ₹499 each time.
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

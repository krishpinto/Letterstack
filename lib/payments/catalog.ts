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
    amount: 500,
    currency: "INR",
    label: "Pro — 1 month",
    description: "LetterStack Pro (1 month)",
    // Open to any signed-in workspace. Nothing is gated on the plan yet, so
    // buying it changes only the Pro mark — no existing behaviour or cap
    // moves for anyone who doesn't buy.
    adminOnly: false,
    grantsPlan: "pro",
    planDays: 30,
  },
} as const;

export function getPaymentItem(key: string) {
  if (!Object.prototype.hasOwnProperty.call(PAYMENT_ITEMS, key)) return null;
  return PAYMENT_ITEMS[key as PaymentItemKey];
}

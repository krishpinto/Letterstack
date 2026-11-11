// The steps that turn a captured payment into access and paperwork, and which
// of them are still outstanding.
//
// Settlement used to run every step only on the call that first marked the
// order paid. If the plan grant threw after that, the retry saw "already
// paid", returned early, and the customer stayed on Free having paid. Now
// each step leaves its own mark on the payment or invoice row, and every call
// — the browser callback, the webhook, a webhook retry — finishes whatever is
// still missing. Each step is guarded in the database so two callers running
// at once can't both perform it.

export type SettlementStep = "grant-plan" | "issue-invoice" | "send-invoice";

export type SettlementState = {
  /** payments.status */
  status: string;
  /** payments.plan_granted_at — set once the grant step has been done (or ruled out). */
  planGrantedAt: Date | null;
  /** Whether the item bought grants a plan. Only those are invoiced. */
  grantsPlan: boolean;
  /** The invoice row, if one has been issued. */
  invoice: { sentAt: Date | null } | null;
  hasBuyerEmail: boolean;
};

export function pendingSettlementSteps(state: SettlementState): SettlementStep[] {
  // Refunded (or never paid): nothing more to hand out.
  if (state.status !== "paid") return [];

  const steps: SettlementStep[] = [];
  if (!state.planGrantedAt) steps.push("grant-plan");

  // The internal ₹1 item grants nothing and never generates a document.
  if (!state.grantsPlan) return steps;

  if (!state.invoice) steps.push("issue-invoice");
  if (!state.invoice?.sentAt && state.hasBuyerEmail) steps.push("send-invoice");
  return steps;
}

export type RefundKind = "full" | "partial" | "none";

/**
 * Whether a refund event refunds the whole payment.
 *
 * Razorpay's payment entity carries the running total (`amount_refunded`)
 * and its own verdict (`refund_status`: "full" | "partial"). Either is
 * enough to call it full; the amount comparison is against what *we*
 * charged, so a payload with a different `amount` can't make a partial
 * refund look full.
 */
export function classifyRefund(input: {
  chargedPaise: number;
  amountRefundedPaise: number | null | undefined;
  refundStatus: string | null | undefined;
}): RefundKind {
  const refunded = Math.max(0, Number(input.amountRefundedPaise ?? 0));
  if (input.refundStatus === "full") return "full";
  if (refunded > 0 && refunded >= input.chargedPaise) return "full";
  if (refunded > 0 || input.refundStatus === "partial") return "partial";
  return "none";
}

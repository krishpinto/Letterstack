// What a refund does to the access a payment bought.
//
// Before this, refunds weren't handled at all: a refunded payment kept the
// plan it had granted. Now a full refund takes back exactly the days that
// payment granted — not time bought by any other payment — and a partial
// refund is recorded and changes nothing, because how much time a partial
// refund should cost is a pricing decision, not something to guess at here.

import { getOrganizationPlan, revokePlanForPayment } from "@/db/organizations";
import { getPaymentById, markPlanRevoked, recordRefund } from "@/db/payments";
import { decidePlanRevocation } from "./plan-period";
import { classifyRefund, type RefundKind } from "./settlement";

export type RefundResult = {
  kind: RefundKind;
  /** False when there was nothing to record: no refund, or one of a payment that was never captured. */
  recorded: boolean;
  /** What happened to the plan. Null when nothing was asked of it. */
  plan: "revoked" | "nothing" | "review" | null;
};

/** Same reasoning as the grant: re-decide when the compare-and-set loses. */
const MAX_REVOKE_ATTEMPTS = 5;

export async function settleRefund(input: {
  razorpayOrderId: string;
  /** Paise we charged for this order, from our own record. */
  chargedPaise: number;
  /** Razorpay's running total for the payment, when the payload carries it. */
  amountRefundedPaise: number | null;
  refundStatus: string | null;
  /**
   * Razorpay auto-refunds payments that were authorised but never captured.
   * Those never settled and granted nothing, and the order may still be paid
   * by another attempt, so they are not recorded against it.
   */
  captured: boolean | null;
}): Promise<RefundResult> {
  if (input.captured === false) return { kind: "none", recorded: false, plan: null };

  const kind = classifyRefund({
    chargedPaise: input.chargedPaise,
    amountRefundedPaise: input.amountRefundedPaise,
    refundStatus: input.refundStatus,
  });
  if (kind === "none") return { kind, recorded: false, plan: null };

  const total =
    input.amountRefundedPaise ?? (kind === "full" ? input.chargedPaise : 0);
  const row = await recordRefund(input.razorpayOrderId, total, kind === "full");
  if (!row) return { kind, recorded: false, plan: null };

  if (kind === "partial") {
    console.warn(
      `Partial refund of ${total} paise on order ${input.razorpayOrderId} recorded; plan left unchanged.`,
    );
    return { kind, recorded: true, plan: null };
  }

  return { kind, recorded: true, plan: await revokePlan(row.id) };
}

async function revokePlan(
  paymentId: string,
): Promise<"revoked" | "nothing" | "review"> {
  for (let attempt = 0; attempt < MAX_REVOKE_ATTEMPTS; attempt += 1) {
    const payment = await getPaymentById(paymentId);
    if (!payment || payment.planRevokedAt) return "nothing";

    // Refunded before the grant ever happened. The 'refunded' status stops
    // settlement from granting it later, so there is nothing to take back.
    if (!payment.planGrantedAt) {
      await markPlanRevoked(payment.id);
      return "nothing";
    }

    const org = await getOrganizationPlan(payment.organizationId);
    if (!org) return "nothing";

    const decision = decidePlanRevocation({
      current: org,
      grantedPlan: payment.planGrantedPlan,
      grantedDays: payment.planGrantedDays ?? 0,
      now: new Date(),
    });

    if (decision.kind === "nothing") {
      await markPlanRevoked(payment.id);
      return "nothing";
    }

    if (decision.kind === "review") {
      // Left unmarked on purpose, so the payment still shows as refunded but
      // not revoked until someone adjusts the workspace by hand.
      console.error(
        `Full refund on order ${payment.razorpayOrderId} needs a manual plan change: ${decision.reason}.`,
      );
      return "review";
    }

    const applied = await revokePlanForPayment({
      paymentId: payment.id,
      organizationId: payment.organizationId,
      expected: org,
      planExpiresAt: decision.expiresAt,
    });
    if (applied) return "revoked";
  }

  throw new Error(
    `Could not revoke the plan for refunded payment ${paymentId} after ${MAX_REVOKE_ATTEMPTS} attempts`,
  );
}

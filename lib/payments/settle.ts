// The one place a payment turns into access.
//
// Two callers reach this — the browser callback (/api/payments/verify) and
// the Razorpay webhook — in either order, at the same time, and the webhook
// retries on top of that. Both funnel through here so they can't drift apart.
//
// Settlement is resumable. Each step records its own completion (see
// lib/payments/settlement.ts), and every call finishes whatever is still
// missing instead of stopping at "already paid". That is what makes a 500
// safe: if the plan grant fails, the webhook answers 500, Razorpay retries,
// and the retry grants the plan — where it used to find the order paid and
// return early, leaving the customer charged and on Free.

import { getOrganizationPlan, grantPlanForPayment } from "@/db/organizations";
import { findInvoiceForPayment } from "@/db/invoices";
import {
  getPaymentById,
  getPaymentByOrderIdUnscoped,
  getSettledPaymentForInvoice,
  latestPaidDailyRate,
  markPlanGrantSettled,
  settlePaymentPaid,
} from "@/db/payments";
import { issueAndSendInvoice } from "@/lib/invoices/issue";
import { activePlanAt } from "@/lib/plans/active";
import type { PlanKey } from "@/lib/plans/limits";
import { getPaymentItem } from "./catalog";
import { decidePlanGrant } from "./plan-period";
import { pendingSettlementSteps, type SettlementStep } from "./settlement";

export type SettleResult = {
  /** True only for the call that marked the order paid. Later calls are normal, not errors. */
  settled: boolean;
  /** The tier this payment's days landed on, once granted. */
  planGranted: string | null;
  /** What this call found still to do. Empty on a fully settled payment. */
  steps: SettlementStep[];
};

/**
 * How many times to re-decide a grant whose compare-and-set lost to a
 * concurrent change. Each loss means something else just moved the
 * workspace's plan, which happens a handful of times at most.
 */
const MAX_GRANT_ATTEMPTS = 5;

export async function settlePaidOrder(
  razorpayOrderId: string,
  razorpayPaymentId: string,
): Promise<SettleResult> {
  const marked = await settlePaymentPaid(razorpayOrderId, razorpayPaymentId);
  const row = marked ?? (await getPaymentByOrderIdUnscoped(razorpayOrderId));
  if (!row) throw new Error(`No payment recorded for order ${razorpayOrderId}`);

  if (row.razorpayPaymentId && row.razorpayPaymentId !== razorpayPaymentId) {
    // A second captured payment on an order we already settled. Settlement
    // is keyed on the order, so it grants nothing more — but someone has to
    // refund it.
    console.error(
      `Order ${razorpayOrderId} settled with ${row.razorpayPaymentId}, ` +
        `but ${razorpayPaymentId} was also captured on it. Refund the second one.`,
    );
  }

  // The item is read off our own record of the order, never off the event
  // payload — the payload says what was paid, not what it entitles.
  const item = getPaymentItem(row.item);
  const grantsPlan = Boolean(item?.grantsPlan);

  const [invoice, invoiceDetails] = grantsPlan
    ? await Promise.all([
        findInvoiceForPayment(row.id),
        getSettledPaymentForInvoice(row.id),
      ])
    : [null, null];

  const steps = pendingSettlementSteps({
    status: row.status,
    planGrantedAt: row.planGrantedAt,
    grantsPlan,
    invoice,
    hasBuyerEmail: Boolean(invoiceDetails?.buyerEmail),
  });

  let planGranted = row.planGrantedPlan ?? null;
  if (steps.includes("grant-plan")) {
    planGranted = await grantPlan(row.id);
  }

  // After the grant, never before: the customer has paid and must get their
  // access whether or not a PDF renders. Only items that grant a plan are
  // invoiced, so the ₹1 internal item never generates a document.
  if (
    invoiceDetails &&
    (steps.includes("issue-invoice") || steps.includes("send-invoice"))
  ) {
    await issueAndSendInvoice(invoiceDetails);
  }

  return { settled: Boolean(marked), planGranted, steps };
}

/**
 * Apply this payment's plan grant, exactly once.
 *
 * Reads the workspace, decides what the period becomes (decidePlanGrant),
 * and writes it with a compare-and-set that also marks the payment granted.
 * If the workspace changed between the read and the write — the other
 * caller settling this same payment, or another order settling — the write
 * matches nothing and this decides again from the fresh state.
 */
async function grantPlan(paymentId: string): Promise<string | null> {
  for (let attempt = 0; attempt < MAX_GRANT_ATTEMPTS; attempt += 1) {
    const payment = await getPaymentById(paymentId);
    if (!payment || payment.status !== "paid") return null;
    // Someone else finished it while we were deciding.
    if (payment.planGrantedAt) return payment.planGrantedPlan;

    // The workspace was deleted between checkout and settlement. The payment
    // row survives that (it is a financial record), but there is nothing
    // left to grant the plan to. Mark the grant settled so retries stop; the
    // payment needs a refund by hand.
    if (!payment.organizationId) {
      console.error(
        `Payment ${payment.id} settled for a deleted workspace; no plan granted. Refund it.`,
      );
      await markPlanGrantSettled(payment.id, null, 0);
      return null;
    }

    const item = getPaymentItem(payment.item);
    if (!item?.grantsPlan) {
      await markPlanGrantSettled(payment.id, null, 0);
      return null;
    }

    const org = await getOrganizationPlan(payment.organizationId);
    if (!org) throw new Error(`Workspace ${payment.organizationId} not found`);

    const now = new Date();
    const running = activePlanAt(org, now);
    const rate =
      running !== "free" && org.planSource === "paid"
        ? await latestPaidDailyRate(payment.organizationId, running)
        : null;

    const decision = decidePlanGrant({
      current: org,
      purchase: {
        plan: item.grantsPlan as PlanKey,
        days: item.planDays,
        amountPaise: payment.amount,
      },
      currentDailyRatePaise: rate,
      now,
    });

    if (decision.kind === "no-change") {
      // Checkout refuses this purchase, so only a race gets here. Record it
      // as handled — retrying can't help — and say loudly that the money
      // needs to go back.
      console.error(
        `Payment for order ${payment.razorpayOrderId} granted nothing: workspace is ${decision.reason}. Refund it.`,
      );
      await markPlanGrantSettled(payment.id, null, 0);
      return null;
    }

    if (decision.kind === "downgrade-credit") {
      console.warn(
        `Order ${payment.razorpayOrderId} bought a lower tier while ${decision.plan} was running; ` +
          `converted to ${decision.grantedDays} days of ${decision.plan}.`,
      );
    }

    const applied = await grantPlanForPayment({
      paymentId: payment.id,
      organizationId: payment.organizationId,
      expected: org,
      next: { plan: decision.plan, planExpiresAt: decision.expiresAt },
      grantedPlan: decision.plan,
      grantedDays: decision.grantedDays,
    });
    if (applied) return decision.plan;
  }

  throw new Error(
    `Could not apply the plan grant for payment ${paymentId} after ${MAX_GRANT_ATTEMPTS} attempts`,
  );
}

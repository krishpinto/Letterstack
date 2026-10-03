// The one place a payment turns into access.
//
// Two callers reach this — the browser callback (/api/payments/verify) and
// the Razorpay webhook — in either order, and the webhook retries on top of
// that. Both funnel through here so they can't drift apart, and so the
// entitlement grant inherits the same exactly-once guarantee the settlement
// update already has.

import { activatePlanForOrganization } from "@/db/organizations";
import {
  getSettledPaymentForInvoice,
  settlePaymentPaid,
} from "@/db/payments";
import { issueAndSendInvoice } from "@/lib/invoices/issue";
import { getPaymentItem } from "./catalog";

export type SettleResult = {
  /** False when someone else settled it first — normal, not an error. */
  settled: boolean;
  planGranted: string | null;
};

export async function settlePaidOrder(
  razorpayOrderId: string,
  razorpayPaymentId: string,
): Promise<SettleResult> {
  const row = await settlePaymentPaid(razorpayOrderId, razorpayPaymentId);

  // Null means this order was already paid: a duplicate webhook, or the
  // browser beat us to it. The grant already happened on that first pass,
  // so doing nothing here is what keeps a retry from extending the paid
  // period a second time.
  if (!row) return { settled: false, planGranted: null };

  // The item is read off our own record of the order, never off the event
  // payload — the payload says what was paid, not what it entitles.
  const item = getPaymentItem(row.item);
  if (!item?.grantsPlan) return { settled: true, planGranted: null };

  await activatePlanForOrganization(
    row.organizationId,
    item.grantsPlan,
    item.planDays,
  );

  // After the grant, never before: the customer has paid and must get their
  // access whether or not a PDF renders. issueAndSendInvoice swallows its own
  // failures for the same reason, so a mail problem can't turn a successful
  // payment into a failed settlement.
  //
  // Only this branch invoices, so the ₹1 and ₹5 internal items — which grant
  // nothing — never generate a document.
  await invoiceSettledPayment(row.id);

  return { settled: true, planGranted: item.grantsPlan };
}

/**
 * Loads everything the invoice needs for a settled payment and sends it.
 *
 * The read is here rather than in lib/invoices so that module stays free of
 * schema knowledge, and so settlement passes an id rather than assembling a
 * payload the invoice layer would have to re-validate.
 */
async function invoiceSettledPayment(paymentId: string): Promise<void> {
  try {
    const details = await getSettledPaymentForInvoice(paymentId);
    if (!details) return;
    await issueAndSendInvoice(details);
  } catch (error) {
    console.error("Could not invoice the settled payment", error);
  }
}

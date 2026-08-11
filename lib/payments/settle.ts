// The one place a payment turns into access.
//
// Two callers reach this — the browser callback (/api/payments/verify) and
// the Razorpay webhook — in either order, and the webhook retries on top of
// that. Both funnel through here so they can't drift apart, and so the
// entitlement grant inherits the same exactly-once guarantee the settlement
// update already has.

import { activatePlanForOrganization } from "@/db/organizations";
import { settlePaymentPaid } from "@/db/payments";
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
  return { settled: true, planGranted: item.grantsPlan };
}

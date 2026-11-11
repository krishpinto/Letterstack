// What buying an item would do to a workspace right now. Server-only: it
// reads the rate the running period was bought at.
//
// create-order and the billing panel's quote endpoint both go through here,
// so the outcome shown before paying and the purchase checkout accepts are
// decided by the same rule settlement applies afterwards.

import { latestPaidDailyRate } from "@/db/payments";
import { activePlanAt } from "@/lib/plans/active";
import type { PlanKey } from "@/lib/plans/limits";
import { getPaymentItem } from "./catalog";
import { quoteCheckout, type CheckoutQuote, type StoredPeriod } from "./plan-period";

/** Null for an item that grants no plan — there is nothing to quote. */
export async function quoteItemForOrganization(
  organization: StoredPeriod & { id: string },
  itemKey: string,
  now: Date = new Date(),
): Promise<CheckoutQuote | null> {
  const item = getPaymentItem(itemKey);
  if (!item?.grantsPlan) return null;

  const running = activePlanAt(organization, now);
  const rate =
    running !== "free" && organization.planSource === "paid"
      ? await latestPaidDailyRate(organization.id, running)
      : null;

  return quoteCheckout({
    current: organization,
    purchase: {
      plan: item.grantsPlan as PlanKey,
      days: item.planDays,
      amountPaise: item.amount,
    },
    currentDailyRatePaise: rate,
    now,
  });
}

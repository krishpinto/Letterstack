import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "./client";
import { payments } from "./schema";

export async function listPayments(organizationId: string) {
  return db
    .select()
    .from(payments)
    .where(eq(payments.organizationId, organizationId))
    .orderBy(desc(payments.createdAt));
}

export async function recordOrder(input: {
  organizationId: string;
  userId: string;
  razorpayOrderId: string;
  /** Catalog key — what settlement will grant for this order. */
  item: string;
  amount: number;
  currency: string;
  receipt: string;
}) {
  const [row] = await db.insert(payments).values(input).returning();
  return row;
}

/**
 * The row backing a verify attempt. Scoped to the org so one workspace can
 * never settle another's order by replaying its id.
 */
export async function getPaymentByOrderId(
  organizationId: string,
  razorpayOrderId: string,
) {
  const [row] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.organizationId, organizationId),
        eq(payments.razorpayOrderId, razorpayOrderId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Look an order up without an org in hand — webhooks arrive unauthenticated. */
export async function getPaymentByOrderIdUnscoped(razorpayOrderId: string) {
  const [row] = await db
    .select()
    .from(payments)
    .where(eq(payments.razorpayOrderId, razorpayOrderId))
    .limit(1);
  return row ?? null;
}

/**
 * Settle an order. Only ever called after a signature has verified —
 * `status: "paid"` here means "Razorpay's own signature checked out", not
 * "the browser told us it went through".
 *
 * Two independent callers race for this: the browser callback and the
 * webhook, in either order, and the webhook retries on top of that. The
 * `ne(status, "paid")` guard makes the update itself the lock — the first
 * writer wins and every later one gets `null` back, so settlement side
 * effects can be hung off a non-null return exactly once.
 */
export async function settlePaymentPaid(
  razorpayOrderId: string,
  razorpayPaymentId: string,
) {
  const [row] = await db
    .update(payments)
    .set({ status: "paid", razorpayPaymentId, paidAt: new Date() })
    .where(
      and(
        eq(payments.razorpayOrderId, razorpayOrderId),
        ne(payments.status, "paid"),
      ),
    )
    .returning();
  return row ?? null;
}

/** Never downgrades a settled payment — a late `failed` event can't unpay it. */
export async function markPaymentFailed(
  razorpayOrderId: string,
  razorpayPaymentId?: string,
) {
  await db
    .update(payments)
    .set({ status: "failed", ...(razorpayPaymentId ? { razorpayPaymentId } : {}) })
    .where(
      and(
        eq(payments.razorpayOrderId, razorpayOrderId),
        ne(payments.status, "paid"),
      ),
    );
}

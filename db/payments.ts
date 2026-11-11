import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
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
 * Mark an order paid. Only ever called after a signature has verified —
 * `status: "paid"` here means "Razorpay's own signature checked out", not
 * "the browser told us it went through".
 *
 * Two independent callers race for this: the browser callback and the
 * webhook, in either order, and the webhook retries on top of that. The
 * status guard makes the update itself the lock — the first writer gets the
 * row, every later one gets `null`. That only says who marked it paid; the
 * steps after it (grant, invoice) are tracked separately so a retry can
 * finish them. See lib/payments/settle.ts.
 *
 * Moves only an unsettled order: a refunded payment must never flip back to
 * paid because a late `payment.captured` retry arrived.
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
        inArray(payments.status, ["created", "failed"]),
      ),
    )
    .returning();
  return row ?? null;
}

/**
 * Never touches a settled payment — a late `failed` event can't unpay a paid
 * order or un-refund a refunded one. A failed attempt can be followed by a
 * successful one on the same order, which settlePaymentPaid still accepts.
 */
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
        inArray(payments.status, ["created", "failed"]),
      ),
    );
}

export async function getPaymentById(paymentId: string) {
  const [row] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);
  return row ?? null;
}

/**
 * Record that the grant step needs no change to the workspace: an item that
 * grants nothing, or a purchase on a workspace that already holds the tier
 * with no end date. Guarded so it can't overwrite a real grant's record.
 */
export async function markPlanGrantSettled(
  paymentId: string,
  grantedPlan: string | null,
  grantedDays: number,
) {
  await db
    .update(payments)
    .set({ planGrantedAt: new Date(), planGrantedPlan: grantedPlan, planGrantedDays: grantedDays })
    .where(and(eq(payments.id, paymentId), isNull(payments.planGrantedAt)));
}

/**
 * Paise per day of the most recent payment whose days landed on `plan` in
 * this workspace — the rate the running period was bought at, used to value
 * its unused part on an upgrade. Null when no payment bought it (a trial or
 * an admin grant), which means there is nothing to convert.
 */
export async function latestPaidDailyRate(
  organizationId: string,
  plan: string,
): Promise<number | null> {
  const [row] = await db
    .select({ amount: payments.amount, days: payments.planGrantedDays })
    .from(payments)
    .where(
      and(
        eq(payments.organizationId, organizationId),
        eq(payments.status, "paid"),
        eq(payments.planGrantedPlan, plan),
        gt(payments.planGrantedDays, 0),
      ),
    )
    .orderBy(desc(payments.planGrantedAt))
    .limit(1);
  if (!row?.days) return null;
  return row.amount / row.days;
}

/**
 * Record a refund against a settled order. The running total only ever goes
 * up, so refund events arriving out of order can't shrink it. A full refund
 * also moves the status to 'refunded', which stops any further settlement
 * step and drops the payment out of everything that counts paid revenue.
 *
 * Recorded whatever our status says: a payment can be refunded from the
 * Razorpay dashboard before our settlement ever ran, and once it reads
 * 'refunded' a late `payment.captured` retry can no longer settle it.
 * Callers skip auto-refunds of payments that were never captured.
 */
export async function recordRefund(
  razorpayOrderId: string,
  amountRefunded: number,
  full: boolean,
) {
  const [row] = await db
    .update(payments)
    .set({
      amountRefunded: sql`GREATEST(${payments.amountRefunded}, ${amountRefunded})`,
      refundedAt: sql`COALESCE(${payments.refundedAt}, now())`,
      ...(full ? { status: "refunded" } : {}),
    })
    .where(eq(payments.razorpayOrderId, razorpayOrderId))
    .returning();
  return row ?? null;
}

/** Record that a refund needed no change to the workspace. */
export async function markPlanRevoked(paymentId: string) {
  await db
    .update(payments)
    .set({ planRevokedAt: new Date() })
    .where(and(eq(payments.id, paymentId), isNull(payments.planRevokedAt)));
}

/**
 * Everything an invoice needs about one settled payment, in a single read.
 *
 * Joined here rather than assembled by the caller so the invoice layer never
 * has to know the schema — it receives a finished payload.
 */
export async function getSettledPaymentForInvoice(paymentId: string) {
  const rows = await db.execute<{
    payment_id: string;
    organization_id: string;
    organization_name: string;
    item: string;
    amount: number;
    currency: string;
    paid_at: string | null;
    razorpay_payment_id: string | null;
    razorpay_order_id: string;
    receipt: string;
    buyer_name: string | null;
    buyer_email: string | null;
  }>(sql`
    SELECT p.id AS payment_id, p.organization_id, o.name AS organization_name,
           p.item, p.amount, p.currency, p.paid_at,
           p.razorpay_payment_id, p.razorpay_order_id, p.receipt,
           u.name AS buyer_name, u.email AS buyer_email
    FROM payments p
    JOIN organizations o ON o.id = p.organization_id
    LEFT JOIN users u ON u.id = p.user_id
    WHERE p.id = ${paymentId} AND p.status = 'paid'
    LIMIT 1
  `);

  const row = rows.rows?.[0] ?? (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!row) return null;

  return {
    paymentId: row.payment_id as string,
    organizationId: row.organization_id as string,
    organizationName: row.organization_name as string,
    item: row.item as string,
    amount: Number(row.amount),
    currency: (row.currency as string) ?? "INR",
    paidAt: row.paid_at ? new Date(row.paid_at as string) : new Date(),
    // Settlement always writes this before we're called; the fallback keeps
    // the type honest rather than asserting.
    razorpayPaymentId: (row.razorpay_payment_id as string) ?? "",
    razorpayOrderId: (row.razorpay_order_id as string) ?? null,
    receipt: (row.receipt as string) ?? null,
    buyerName: (row.buyer_name as string) ?? null,
    buyerEmail: (row.buyer_email as string) ?? null,
  };
}

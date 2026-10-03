import { and, desc, eq, ne, sql } from "drizzle-orm";
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

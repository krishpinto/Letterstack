// Issuing and recording invoices.
//
// The serial is the delicate part. Numbers must be unique, gapless enough to
// satisfy an accountant, and restart each Indian financial year — and they are
// allocated from a settlement path that can run twice for the same payment
// (the browser callback races the Razorpay webhook, and the webhook retries on
// top of that).
//
// So: one invoice per payment, enforced by a unique index rather than by
// checking first and hoping. `issueInvoiceForPayment` is safe to call as often
// as settlement happens — the first call issues, every later one returns what
// was issued.

import { desc, eq } from "drizzle-orm";

import { db } from "./client";
import { invoices } from "./schema";
import { financialYear, invoiceNumber } from "@/lib/invoices/invoice";

export type InvoiceRecord = {
  id: string;
  number: string;
  financialYear: string;
  sequence: number;
  amount: number;
  currency: string;
  issuedAt: Date;
  sentAt: Date | null;
  sentTo: string | null;
};

/** How many times to retry when two settlements grab the same serial. */
const MAX_ALLOCATION_ATTEMPTS = 5;

export async function findInvoiceForPayment(
  paymentId: string,
): Promise<InvoiceRecord | null> {
  const [row] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.paymentId, paymentId))
    .limit(1);
  return row ? toRecord(row) : null;
}

/**
 * The invoice for this payment, issuing one if it doesn't exist yet.
 *
 * Idempotent by payment: a second settlement of the same order returns the
 * invoice the first one issued, so a retrying webhook can never hand the same
 * customer two serials for one payment.
 */
export async function issueInvoiceForPayment(input: {
  paymentId: string;
  organizationId: string;
  amount: number;
  currency: string;
  issuedAt: Date;
}): Promise<InvoiceRecord> {
  const existing = await findInvoiceForPayment(input.paymentId);
  if (existing) return existing;

  const year = financialYear(input.issuedAt);

  // Read the last serial, then insert the next one. Two settlements running at
  // once can read the same MAX and collide — the unique index on
  // (financial_year, sequence) rejects the loser, which simply tries again
  // with the number that is now free. Cheaper and clearer than locking the
  // table for what is a handful of writes a month.
  for (let attempt = 0; attempt < MAX_ALLOCATION_ATTEMPTS; attempt += 1) {
    const [last] = await db
      .select({ sequence: invoices.sequence })
      .from(invoices)
      .where(eq(invoices.financialYear, year))
      .orderBy(desc(invoices.sequence))
      .limit(1);

    const next = (last?.sequence ?? 0) + 1;

    try {
      const [row] = await db
        .insert(invoices)
        .values({
          organizationId: input.organizationId,
          paymentId: input.paymentId,
          financialYear: year,
          sequence: next,
          number: invoiceNumber(next, input.issuedAt),
          amount: input.amount,
          currency: input.currency,
          issuedAt: input.issuedAt,
        })
        .returning();
      return toRecord(row);
    } catch (error) {
      // Someone else inserted between our read and our write. If they took the
      // payment (not just the serial), theirs is the invoice — return it.
      const raced = await findInvoiceForPayment(input.paymentId);
      if (raced) return raced;
      if (attempt === MAX_ALLOCATION_ATTEMPTS - 1) throw error;
    }
  }

  // Unreachable: the loop either returns or throws on its final attempt.
  throw new Error("Could not allocate an invoice number");
}

/**
 * Records that the invoice email actually went out.
 *
 * A resend overwrites rather than being rejected: the question this column
 * answers is "where did it last go, and did it get there", and the most recent
 * delivery is the useful answer.
 */
export async function markInvoiceSent(
  invoiceId: string,
  sentTo: string,
  sesMessageId: string,
): Promise<void> {
  await db
    .update(invoices)
    .set({ sentTo, sesMessageId, sentAt: new Date() })
    .where(eq(invoices.id, invoiceId));
}

function toRecord(row: typeof invoices.$inferSelect): InvoiceRecord {
  return {
    id: row.id,
    number: row.number,
    financialYear: row.financialYear,
    sequence: row.sequence,
    amount: row.amount,
    currency: row.currency,
    issuedAt: row.issuedAt,
    sentAt: row.sentAt,
    sentTo: row.sentTo,
  };
}

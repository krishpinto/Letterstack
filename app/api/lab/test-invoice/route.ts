// Dev-only invoice preview and test send.
//
// Lives under /api/lab, which proxy.ts 404s in production — same as the other
// lab tools, and for the same reason: this one reads live payments and can send
// real mail.
//
// A standalone tsx script was the obvious home for this, but @react-pdf's
// packages are ESM-only with no `require` condition, and tsx resolves either
// those exports or the `@/` path aliases, not both. Next resolves both, and
// this is the runtime the real settlement path renders in anyway — so the test
// matches production rather than approximating it.
//
//   GET /api/lab/test-invoice                    → PDF in the browser
//   GET /api/lab/test-invoice?send=you@mail.com  → emails it, PDF attached
//   GET /api/lab/test-invoice?payment=pay_XXXX   → a specific payment

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  issueInvoiceForPayment,
  markInvoiceSent,
} from "@/db/invoices";
import {
  describePurchase,
  invoiceNumber,
  servicePeriod,
  type Invoice,
} from "@/lib/invoices/invoice";
import { invoiceFileName, renderInvoicePdf } from "@/lib/invoices/render";
import { sendInvoiceEmail } from "@/lib/invoices/send-invoice";
import { supplier, supplierSuggestions } from "@/lib/invoices/supplier";

// @react-pdf renders with Node APIs — this can't run on the Edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PaymentRow = {
  payment_id: string;
  organization_id: string;
  razorpay_payment_id: string;
  razorpay_order_id: string | null;
  receipt: string | null;
  item: string;
  amount: number;
  currency: string;
  paid_at: string;
  org_name: string;
  buyer_name: string | null;
  buyer_email: string | null;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sendTo = url.searchParams.get("send");
  const paymentId = url.searchParams.get("payment");

  // The most recent real settled payment, ignoring the ₹1 and ₹5 smoke tests.
  const result = await db.execute<PaymentRow>(sql`
    SELECT p.id AS payment_id, p.organization_id,
           p.razorpay_payment_id, p.razorpay_order_id, p.receipt,
           p.item, p.amount, p.currency, p.paid_at,
           o.name AS org_name, u.name AS buyer_name, u.email AS buyer_email
    FROM payments p
    JOIN organizations o ON o.id = p.organization_id
    LEFT JOIN users u ON u.id = p.user_id
    WHERE p.status = 'paid'
      AND p.amount > 1000
      AND (${paymentId}::text IS NULL OR p.razorpay_payment_id = ${paymentId})
    ORDER BY p.paid_at DESC
    LIMIT 1
  `);

  const row = result.rows?.[0] ?? (result as unknown as PaymentRow[])[0];
  if (!row) {
    return NextResponse.json({ error: "No settled payment found." }, { status: 404 });
  }

  const paidAt = new Date(row.paid_at);
  const amount = Number(row.amount) / 100;
  const { description, days } = describePurchase(row.item);
  const from = supplier();

  const invoice: Invoice = {
    // Placeholder serial — there's no invoices table yet, so nothing has
    // actually been issued. This shows the format only.
    number: invoiceNumber(1, paidAt),
    issuedAt: paidAt,
    billedBy: {
      name: from.name,
      addressLines: from.addressLines,
      email: from.email,
    },
    billedTo: {
      // The account holder's display name and nothing else. No address: none is
      // captured anywhere today, and an invoice that omits one is honest where
      // an invented one is not. Falls back to the workspace name only if the
      // account has no name set.
      name: row.buyer_name || row.org_name,
      addressLines: [],
      email: row.buyer_email,
    },
    description,
    periodLabel: servicePeriod(paidAt, days),
    amount,
    currency: row.currency ?? "INR",
    razorpayPaymentId: row.razorpay_payment_id,
    razorpayOrderId: row.razorpay_order_id,
    receipt: row.receipt,
    paidAt,
  };

  // ?issue=1 runs the real path: allocates a serial from the invoices table,
  // records the send, and is idempotent per payment. Without it the route only
  // previews, so repeated layout checks don't burn invoice numbers.
  if (sendTo && url.searchParams.get("issue") === "1") {
    const record = await issueInvoiceForPayment({
      paymentId: row.payment_id,
      organizationId: row.organization_id,
      amount: Number(row.amount),
      currency: row.currency ?? "INR",
      issuedAt: paidAt,
    });

    const issued: Invoice = { ...invoice, number: record.number };
    const messageId = await sendInvoiceEmail(issued, sendTo);
    await markInvoiceSent(record.id, sendTo, messageId);

    return NextResponse.json({
      issued: true,
      number: record.number,
      sequence: record.sequence,
      financialYear: record.financialYear,
      to: sendTo,
      messageId,
    });
  }

  if (sendTo) {
    const messageId = await sendInvoiceEmail(invoice, sendTo);
    return NextResponse.json({
      sent: true,
      to: sendTo,
      messageId,
      invoice: invoice.number,
      amount: `${invoice.currency} ${amount}`,
      // Advisory only — the invoice sends either way.
      worthSetting: supplierSuggestions(from),
    });
  }

  const pdf = await renderInvoicePdf(invoice);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoiceFileName(invoice)}"`,
    },
  });
}

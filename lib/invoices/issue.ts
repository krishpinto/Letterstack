// Turning a settled payment into an invoice the customer actually receives.
//
// Sits between the payments layer and the PDF so `settlePaidOrder` stays about
// entitlements: it calls one function here and doesn't care how a serial is
// allocated or what the document looks like.

import {
  claimInvoiceEmail,
  issueInvoiceForPayment,
  markInvoiceSent,
  releaseInvoiceEmail,
} from "@/db/invoices";

import {
  describePurchase,
  servicePeriod,
  type Invoice,
} from "./invoice";
import { sendInvoiceEmail } from "./send-invoice";
import { supplier } from "./supplier";

export type SettledPayment = {
  paymentId: string;
  organizationId: string;
  organizationName: string;
  /** Catalog key, e.g. pro_yearly. */
  item: string;
  /** Paise. */
  amount: number;
  currency: string;
  paidAt: Date;
  razorpayPaymentId: string;
  razorpayOrderId: string | null;
  receipt: string | null;
  /** Account holder — the name and address the invoice is made out to. */
  buyerName: string | null;
  buyerEmail: string | null;
};

/** Builds the document for a payment that already has its serial allocated. */
export function buildInvoice(
  payment: SettledPayment,
  number: string,
): Invoice {
  const from = supplier();
  const { description, days } = describePurchase(payment.item);

  return {
    number,
    issuedAt: payment.paidAt,
    billedBy: {
      name: from.name,
      addressLines: from.addressLines,
      email: from.email,
    },
    billedTo: {
      // The account holder's display name. No address is captured anywhere, and
      // an invoice that omits one is honest where an invented one is not.
      name: payment.buyerName || payment.organizationName,
      addressLines: [],
      email: payment.buyerEmail,
    },
    description,
    periodLabel: servicePeriod(payment.paidAt, days),
    amount: payment.amount / 100,
    currency: payment.currency,
    razorpayPaymentId: payment.razorpayPaymentId,
    razorpayOrderId: payment.razorpayOrderId,
    receipt: payment.receipt,
    paidAt: payment.paidAt,
  };
}

/**
 * Issues the invoice for a settled payment and emails it, doing only what a
 * previous pass left undone.
 *
 * Issuing is idempotent by payment: the serial is allocated once, so a retry
 * finds the same invoice rather than minting a second number. It throws on
 * failure, so the webhook answers 500 and Razorpay retries until the invoice
 * exists — previously only the first settlement pass ever issued one.
 *
 * Emailing never throws. A PDF that won't render or an SES error is not a
 * reason to keep a payment webhook failing (Razorpay disables a webhook that
 * fails for a day). The send is claimed first so two concurrent settlements
 * don't both mail it, and a failure releases the claim so the next
 * settlement call for this payment tries again.
 */
export async function issueAndSendInvoice(
  payment: SettledPayment,
): Promise<{ number: string; sent: boolean }> {
  const record = await issueInvoiceForPayment({
    paymentId: payment.paymentId,
    organizationId: payment.organizationId,
    amount: payment.amount,
    currency: payment.currency,
    issuedAt: payment.paidAt,
  });

  if (record.sentAt) return { number: record.number, sent: true };

  if (!payment.buyerEmail) {
    console.warn(
      `Invoice ${record.number} issued with no buyer email — not sent.`,
    );
    return { number: record.number, sent: false };
  }

  if (!(await claimInvoiceEmail(record.id))) {
    // Another settlement call is sending it right now, or already has.
    return { number: record.number, sent: false };
  }

  try {
    const invoice = buildInvoice(payment, record.number);
    const messageId = await sendInvoiceEmail(invoice, payment.buyerEmail);
    await markInvoiceSent(record.id, payment.buyerEmail, messageId);
    return { number: record.number, sent: true };
  } catch (error) {
    console.error(`Could not send invoice ${record.number}`, error);
    await releaseInvoiceEmail(record.id).catch(() => {});
    return { number: record.number, sent: false };
  }
}

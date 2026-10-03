// Turning a settled payment into an invoice the customer actually receives.
//
// Sits between the payments layer and the PDF so `settlePaidOrder` stays about
// entitlements: it calls one function here and doesn't care how a serial is
// allocated or what the document looks like.

import { issueInvoiceForPayment, markInvoiceSent } from "@/db/invoices";

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
 * Issues the invoice for a settled payment and emails it.
 *
 * Idempotent by payment: the serial is allocated once, so a webhook retry
 * re-sends the same invoice number rather than minting a second one.
 *
 * Never throws. Settlement has already granted the plan by the time this runs,
 * and an invoice that failed to render is not a reason to unwind a payment the
 * customer has made — the failure is logged and the invoice can be resent.
 * The row records whether the email actually went out.
 */
export async function issueAndSendInvoice(
  payment: SettledPayment,
): Promise<{ number: string; sent: boolean } | null> {
  try {
    const record = await issueInvoiceForPayment({
      paymentId: payment.paymentId,
      organizationId: payment.organizationId,
      amount: payment.amount,
      currency: payment.currency,
      issuedAt: payment.paidAt,
    });

    if (!payment.buyerEmail) {
      console.warn(
        `Invoice ${record.number} issued with no buyer email — not sent.`,
      );
      return { number: record.number, sent: false };
    }

    const invoice = buildInvoice(payment, record.number);
    const messageId = await sendInvoiceEmail(invoice, payment.buyerEmail);
    await markInvoiceSent(record.id, payment.buyerEmail, messageId);

    return { number: record.number, sent: true };
  } catch (error) {
    console.error("Could not issue or send the invoice", error);
    return null;
  }
}

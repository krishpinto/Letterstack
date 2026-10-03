// The shape of an invoice, and the rules for numbering and formatting one.
//
// Kept free of React and of the database so both the PDF renderer and the send
// path build the same object from the same rules.

import {
  PAYMENT_ITEMS,
  itemDisplayName,
  type PaymentItemKey,
} from "@/lib/payments/catalog";

export type InvoiceParty = {
  name: string;
  addressLines: string[];
  email: string | null;
};

export type Invoice = {
  /** Human-facing serial, e.g. LS/2026-27/0001. */
  number: string;
  issuedAt: Date;
  billedBy: InvoiceParty;
  billedTo: InvoiceParty;
  description: string;
  /** Service period this covers, already formatted. */
  periodLabel: string | null;
  /** Whole rupees. No tax component — see lib/invoices/supplier.ts. */
  amount: number;
  currency: string;
  /**
   * Razorpay's own references, printed so a query about this invoice can be
   * traced in three directions at once: the customer quotes the payment id to
   * their bank, we search the Razorpay dashboard by order id, and the receipt
   * is what ties it back to our own payments row.
   */
  razorpayPaymentId: string;
  razorpayOrderId: string | null;
  /** Our internal order reference (payments.receipt), e.g. ls_1a2b_8f3c. */
  receipt: string | null;
  paidAt: Date | null;
};

/**
 * The Indian financial year a date falls in, as "2026-27".
 *
 * April to March, so anything before April belongs to the year that started the
 * previous calendar year. Invoice serials restart each financial year, which is
 * what an accountant expects to see.
 */
export function financialYear(date: Date): string {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** LS/2026-27/0001 — prefix, financial year, then a zero-padded sequence. */
export function invoiceNumber(sequence: number, date: Date): string {
  return `LS/${financialYear(date)}/${String(sequence).padStart(4, "0")}`;
}

/**
 * Indian digit grouping: 10,000 and 1,00,000, not 100,000.
 *
 * Written out rather than relying on Intl, because the PDF renderer runs in
 * environments where full ICU data isn't guaranteed and a silently wrong
 * grouping on a money document is not worth the risk.
 */
export function formatIndianNumber(amount: number): string {
  const fixed = Math.abs(amount).toFixed(2);
  const [whole, decimals] = fixed.split(".");

  let grouped: string;
  if (whole.length <= 3) {
    grouped = whole;
  } else {
    const lastThree = whole.slice(-3);
    const rest = whole.slice(0, -3);
    grouped = `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${lastThree}`;
  }

  return `${amount < 0 ? "-" : ""}${grouped}.${decimals}`;
}

/**
 * Money as it appears on the document.
 *
 * "INR" rather than the ₹ symbol: the PDF's standard fonts have no glyph for
 * U+20B9, and a missing glyph on the total line is a support ticket. INR is
 * unambiguous and prints everywhere.
 */
export function formatMoney(amount: number, currency = "INR"): string {
  return `${currency} ${formatIndianNumber(amount)}`;
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty",
  "Ninety",
];

function underThousand(value: number): string {
  if (value === 0) return "";
  if (value < 20) return ONES[value];
  if (value < 100) {
    const rest = value % 10;
    return `${TENS[Math.floor(value / 10)]}${rest ? ` ${ONES[rest]}` : ""}`;
  }
  const rest = value % 100;
  return `${ONES[Math.floor(value / 100)]} Hundred${rest ? ` ${underThousand(rest)}` : ""}`;
}

/**
 * The amount written out, Indian-style: crore, lakh, thousand.
 *
 * Indian invoices conventionally carry the total in words as a check against a
 * mistyped figure, and they group by lakh and crore rather than million — a
 * western words helper would read "ten thousand" where an Indian accountant
 * expects "Ten Thousand" to roll up into lakhs past 99,999.
 */
export function amountInWords(amount: number, currency = "INR"): string {
  const whole = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - whole) * 100);

  if (whole === 0 && paise === 0) return `${currency} Zero Only`;

  const parts: string[] = [];
  const crore = Math.floor(whole / 10_000_000);
  const lakh = Math.floor((whole % 10_000_000) / 100_000);
  const thousand = Math.floor((whole % 100_000) / 1_000);
  const rest = whole % 1_000;

  if (crore) parts.push(`${underThousand(crore)} Crore`);
  if (lakh) parts.push(`${underThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${underThousand(thousand)} Thousand`);
  if (rest) parts.push(underThousand(rest));

  const rupees = parts.join(" ");
  const paiseText = paise ? ` and ${underThousand(paise)} Paise` : "";
  return `${currency} ${rupees}${paiseText} Only`;
}

export function formatInvoiceDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

/**
 * What the customer actually bought, named the way the product names it.
 *
 * The name comes from itemDisplayName, which derives it from the plan table —
 * the item's own `description` string still says "Pro" for the tier the product
 * now calls Starter.
 */
export function describePurchase(item: PaymentItemKey | string): {
  description: string;
  days: number;
} {
  const entry = PAYMENT_ITEMS[item as PaymentItemKey];
  return {
    description: itemDisplayName(item),
    days: entry?.planDays ?? 0,
  };
}

/** "01 Oct 2026 – 01 Oct 2027", or null when the purchase grants no period. */
export function servicePeriod(start: Date, days: number): string | null {
  if (!days) return null;
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return `${formatInvoiceDate(start)} to ${formatInvoiceDate(end)}`;
}

// Invoice PDF → bytes.
//
// Separated from the document itself so the React-PDF import stays out of any
// module that only needs invoice types or formatting. renderToBuffer is Node
// only, which is fine: invoices are generated on the settlement path and in
// scripts, never in the browser or on the Edge runtime.

import { renderToBuffer } from "@react-pdf/renderer";

import { InvoiceDocument } from "./invoice-document";
import type { Invoice } from "./invoice";

export async function renderInvoicePdf(invoice: Invoice): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument invoice={invoice} />);
}

/** Filename the customer sees when they save the attachment. */
export function invoiceFileName(invoice: Invoice): string {
  // Slashes are legal in an invoice serial and illegal in a filename.
  return `invoice-${invoice.number.replace(/\//g, "-")}.pdf`;
}

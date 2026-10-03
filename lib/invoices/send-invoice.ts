// Renders an invoice and mails it with the PDF attached.
//
// One function so the settlement path, the admin panel and any backfill script
// all produce the same document and the same covering email.

import { escapeHtml } from "@/lib/notifications/email-shell";
import { sendEmailWithAttachments } from "@/lib/send/ses";
import { supportInboxes } from "@/lib/support-inbox";

import { formatInvoiceDate, formatMoney, type Invoice } from "./invoice";
import { invoiceFileName, renderInvoicePdf } from "./render";


function body(invoice: Invoice) {
  const total = formatMoney(invoice.amount, invoice.currency);
  const paidOn = invoice.paidAt ? formatInvoiceDate(invoice.paidAt) : null;

  // Short on purpose. The PDF is the document; this is the covering note, and a
  // receipt nobody has to read is a receipt that works.
  const text = [
    `Hi${invoice.billedTo.name ? ` ${invoice.billedTo.name}` : ""},`,
    "",
    `Thank you — your payment of ${total} has been received${paidOn ? ` on ${paidOn}` : ""}.`,
    "",
    `Invoice ${invoice.number} is attached as a PDF.`,
    invoice.periodLabel ? `This covers ${invoice.periodLabel}.` : "",
    "",
    // No mention of an address: none is captured or printed, so offering to
    // change one would promise something the invoice can't show.
    "If anything on the invoice needs changing — a different billing name for",
    "your records — just reply to this email and we'll reissue it.",
    "",
    `— ${invoice.billedBy.name}`,
  ]
    .filter((segment) => segment !== "")
    .join("\n");

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#1A1626;max-width:520px">
      <p>Hi${invoice.billedTo.name ? ` ${escapeHtml(invoice.billedTo.name)}` : ""},</p>
      <p>Thank you — your payment of <strong>${escapeHtml(total)}</strong> has been received${
        paidOn ? ` on ${escapeHtml(paidOn)}` : ""
      }.</p>
      <p>Invoice <strong>${escapeHtml(invoice.number)}</strong> is attached as a PDF.${
        invoice.periodLabel
          ? ` This covers ${escapeHtml(invoice.periodLabel)}.`
          : ""
      }</p>
      <p style="color:#6E6885;font-size:14px">If anything on the invoice needs changing — a different
      billing name for your records — just reply to this email and we'll reissue it.</p>
      <p>— ${escapeHtml(invoice.billedBy.name)}</p>
    </div>
  `.trim();

  return { text, html };
}

/** Mails `invoice` to `to`, PDF attached. Returns the SES message id. */
export async function sendInvoiceEmail(
  invoice: Invoice,
  to: string,
): Promise<string> {
  const pdf = await renderInvoicePdf(invoice);
  const { text, html } = body(invoice);

  return sendEmailWithAttachments({
    to,
    subject: `Invoice ${invoice.number} from ${invoice.billedBy.name}`,
    text,
    html,
    fromName: invoice.billedBy.name,
    fromEmail: process.env.MAIL_FROM ?? "",
    // Not billedBy.email: that defaults to MAIL_FROM, whose domain has no
    // MX records, so a reply there is silently discarded.
    replyTo: supportInboxes(),
    attachments: [
      {
        filename: invoiceFileName(invoice),
        content: pdf,
        contentType: "application/pdf",
      },
    ],
    tags: [{ name: "type", value: "invoice" }],
  });
}

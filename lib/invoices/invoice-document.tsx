// The invoice PDF — dark, edge-to-edge grid, after Invoicely's "Vercel" theme.
//
// The layout idea is that the page *is* the grid: no page margin, every region
// a cell bounded by hairlines, the serial number oversized in the top-left
// cell, and all figures in a monospace face so columns of digits line up.
//
// Built with @react-pdf's own StyleSheet rather than a Tailwind-for-PDF bridge:
// this is one fixed layout, not a design system, and the renderer supports only
// a subset of CSS — explicit styles mean what's written here is what prints.
//
// Fonts are the PDF base-14 (Helvetica, Courier) on purpose. Registering Geist
// would mean fetching font files at render time, and an invoice that fails to
// generate because a CDN was slow is a worse trade than a near-identical face.

import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import {
  amountInWords,
  formatInvoiceDate,
  formatMoney,
  type Invoice,
} from "./invoice";

const ground = "#0A0A0A";
const rowAlt = "#111111";
const rule = "#1F1F1F";
const bright = "#FAFAFA";
const mid = "#A1A1A1";
const dim = "#6E6E6E";
const faint = "#525252";

const styles = StyleSheet.create({
  page: {
    backgroundColor: ground,
    color: bright,
    fontFamily: "Helvetica",
    fontSize: 9,
    lineHeight: 1.45,
    // No page padding — the grid runs to the trim, which is the whole look.
    paddingBottom: 0,
  },

  serialCell: {
    borderBottomWidth: 1,
    borderBottomColor: rule,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  serial: {
    fontSize: 34,
    // Explicit: the page's 1.45 line-height leaves a 34px box too short for
    // its own glyphs, which let the eyebrow above collide with the descenders.
    lineHeight: 1.1,
    letterSpacing: -1.2,
    color: bright,
    fontFamily: "Courier-Bold",
  },
  eyebrow: {
    fontSize: 7.5,
    letterSpacing: 1.6,
    color: dim,
    marginBottom: 8,
  },

  metaStrip: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: rule,
  },
  metaCell: {
    width: "50%",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  metaCellLeft: { borderRightWidth: 1, borderRightColor: rule },
  metaRow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  metaLabel: { width: 92, color: faint, fontSize: 7.5 },
  metaValue: { color: mid, fontSize: 7.5, fontFamily: "Courier" },

  parties: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: rule,
  },
  party: { width: "50%", paddingHorizontal: 20, paddingVertical: 14 },
  partyRight: { borderLeftWidth: 1, borderLeftColor: rule },
  partyLabel: { color: dim, fontSize: 8, marginBottom: 6 },
  partyName: { color: bright, fontSize: 11, fontFamily: "Helvetica-Bold" },
  partyLine: { color: mid, fontSize: 7.5, marginTop: 2 },

  tableHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: rule,
  },
  headText: { color: bright, fontSize: 8.5 },
  row: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: rule,
    backgroundColor: rowAlt,
  },
  colItem: { width: "62%", paddingRight: 14 },
  colQty: { width: "10%", textAlign: "center" },
  colPrice: { width: "14%", textAlign: "right" },
  colTotal: { width: "14%", textAlign: "right" },
  itemName: { color: bright, fontSize: 9.5 },
  itemMeta: { color: faint, fontSize: 7.5, marginTop: 3 },
  figure: { color: mid, fontSize: 8, fontFamily: "Courier" },

  spacer: { flexGrow: 1 },

  footGrid: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: rule,
  },
  footLeft: { width: "50%", borderRightWidth: 1, borderRightColor: rule },
  footRight: { width: "50%" },
  block: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  blockDivided: { borderTopWidth: 1, borderTopColor: rule },
  blockTitle: { color: bright, fontSize: 9 },
  kvRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  kvLabel: { width: 92, color: faint, fontSize: 7.5 },
  kvValue: { color: mid, fontSize: 7.5, fontFamily: "Courier", flex: 1 },
  note: { color: faint, fontSize: 7.5, marginTop: 5, lineHeight: 1.5 },

  sumRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  sumLabel: { color: faint, fontSize: 8 },
  sumValue: { color: mid, fontSize: 8, fontFamily: "Courier" },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: rule,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  totalLabel: { color: mid, fontSize: 10 },
  totalValue: { color: bright, fontSize: 15, fontFamily: "Courier-Bold" },

  wordsLabel: { color: faint, fontSize: 7 },
  words: { color: mid, fontSize: 7.5, marginTop: 3 },

  paid: {
    alignSelf: "flex-start",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#1F4433",
    backgroundColor: "#0E2219",
    color: "#4ADE80",
    borderRadius: 3,
    paddingVertical: 3,
    paddingHorizontal: 8,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.8,
  },
});

export function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  const money = formatMoney(invoice.amount, invoice.currency);
  // One line item today — a plan purchase. Kept as a table so adding a second
  // product later is a row, not a redesign.
  const quantity = 1;

  return (
    <Document
      title={`Invoice ${invoice.number}`}
      author={invoice.billedBy.name}
      creator={invoice.billedBy.name}
      producer="LetterStack"
      subject={`${invoice.description} — ${invoice.number}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.serialCell}>
          {/* Not "Tax Invoice" — that title is reserved for GST-registered
              suppliers, which LetterStack is not. */}
          <Text style={styles.eyebrow}>
            {invoice.billedBy.name.toUpperCase()} · INVOICE
          </Text>
          <Text style={styles.serial}>{invoice.number}</Text>
        </View>

        <View style={styles.metaStrip}>
          <View style={[styles.metaCell, styles.metaCellLeft]}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Invoice number</Text>
              <Text style={styles.metaValue}>{invoice.number}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date of issue</Text>
              <Text style={styles.metaValue}>
                {formatInvoiceDate(invoice.issuedAt)}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Currency</Text>
              <Text style={styles.metaValue}>{invoice.currency}</Text>
            </View>
          </View>

          <View style={styles.metaCell}>
            {invoice.periodLabel ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Service period</Text>
                <Text style={styles.metaValue}>{invoice.periodLabel}</Text>
              </View>
            ) : null}
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Status</Text>
              <Text style={styles.metaValue}>
                {invoice.paidAt ? "PAID" : "DUE"}
              </Text>
            </View>
            {invoice.paidAt ? (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Paid on</Text>
                <Text style={styles.metaValue}>
                  {formatInvoiceDate(invoice.paidAt)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.partyLabel}>Billed By</Text>
            <Text style={styles.partyName}>{invoice.billedBy.name}</Text>
            {invoice.billedBy.addressLines.map((addressLine) => (
              <Text key={addressLine} style={styles.partyLine}>
                {addressLine}
              </Text>
            ))}
            {invoice.billedBy.email ? (
              <Text style={styles.partyLine}>{invoice.billedBy.email}</Text>
            ) : null}
          </View>

          <View style={[styles.party, styles.partyRight]}>
            <Text style={styles.partyLabel}>Billed To</Text>
            <Text style={styles.partyName}>{invoice.billedTo.name}</Text>
            {invoice.billedTo.addressLines.map((addressLine) => (
              <Text key={addressLine} style={styles.partyLine}>
                {addressLine}
              </Text>
            ))}
            {invoice.billedTo.email ? (
              <Text style={styles.partyLine}>{invoice.billedTo.email}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.tableHead}>
          <Text style={[styles.colItem, styles.headText]}>Item</Text>
          <Text style={[styles.colQty, styles.headText]}>Qty</Text>
          <Text style={[styles.colPrice, styles.headText]}>Price</Text>
          <Text style={[styles.colTotal, styles.headText]}>Total</Text>
        </View>

        <View style={styles.row} wrap={false}>
          <View style={styles.colItem}>
            <Text style={styles.itemName}>{invoice.description}</Text>
            {invoice.periodLabel ? (
              <Text style={styles.itemMeta}>{invoice.periodLabel}</Text>
            ) : null}
          </View>
          <Text style={[styles.colQty, styles.figure]}>{quantity}</Text>
          <Text style={[styles.colPrice, styles.figure]}>{money}</Text>
          <Text style={[styles.colTotal, styles.figure]}>{money}</Text>
        </View>

        {/* Pushes the summary grid to the foot of the page, as the theme does. */}
        <View style={styles.spacer} />

        <View style={styles.footGrid} wrap={false}>
          <View style={styles.footLeft}>
            <View style={styles.block}>
              <Text style={styles.blockTitle}>Payment information</Text>
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Gateway</Text>
                <Text style={styles.kvValue}>Razorpay</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvLabel}>Payment ID</Text>
                <Text style={styles.kvValue}>{invoice.razorpayPaymentId}</Text>
              </View>
              {invoice.razorpayOrderId ? (
                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Order ID</Text>
                  <Text style={styles.kvValue}>{invoice.razorpayOrderId}</Text>
                </View>
              ) : null}
              {invoice.receipt ? (
                <View style={styles.kvRow}>
                  <Text style={styles.kvLabel}>Receipt</Text>
                  <Text style={styles.kvValue}>{invoice.receipt}</Text>
                </View>
              ) : null}
              {invoice.paidAt ? <Text style={styles.paid}>PAID IN FULL</Text> : null}
            </View>

            <View style={[styles.block, styles.blockDivided]}>
              <Text style={styles.blockTitle}>Notes</Text>
              {/* Required in substance: a customer's accountant will look for a
                  tax line and needs to know why there isn't one, rather than
                  assuming the invoice is incomplete. */}
              <Text style={styles.note}>
                {invoice.billedBy.name} is not registered under GST. No tax has
                been charged on this invoice.
              </Text>
              <Text style={styles.note}>
                This document is a receipt for a payment already made. No action
                is required.
              </Text>
            </View>
          </View>

          <View style={styles.footRight}>
            <View style={styles.block}>
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>Subtotal</Text>
                <Text style={styles.sumValue}>{money}</Text>
              </View>
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>Tax</Text>
                <Text style={styles.sumValue}>—</Text>
              </View>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{money}</Text>
            </View>

            <View style={[styles.block, styles.blockDivided]}>
              <Text style={styles.wordsLabel}>Invoice total (in words)</Text>
              <Text style={styles.words}>
                {amountInWords(invoice.amount, invoice.currency)}
              </Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

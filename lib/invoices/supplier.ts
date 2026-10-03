// Who the invoice is from.
//
// Everything has a working default drawn from what the app already knows, so an
// invoice is never blocked on configuration and never prints a placeholder. The
// env vars exist to override those defaults with the registered legal name and
// address once they're settled.
//
// No GST fields on purpose. LetterStack is not registered under GST, so this
// document is a bill of supply: no GSTIN, no tax component, and never titled
// "Tax Invoice". Registering later means a new field set and a new title, not a
// tweak here.

export type Supplier = {
  name: string;
  /** Optional — omitted from the PDF entirely rather than faked. */
  addressLines: string[];
  email: string;
  website: string | null;
};

export function supplier(): Supplier {
  const address = process.env.INVOICE_SUPPLIER_ADDRESS ?? "";

  return {
    name: process.env.INVOICE_SUPPLIER_NAME || "LetterStack",
    // One address line per "\n"; a literal backslash-n in the env var counts.
    addressLines: address
      .split(/\\n|\n/)
      .map((line) => line.trim())
      .filter(Boolean),
    // Falls back to the verified sending address, which is where a reply would
    // land anyway.
    email:
      process.env.INVOICE_SUPPLIER_EMAIL ||
      process.env.MAIL_FROM ||
      "hello@letterstack.site",
    website: process.env.INVOICE_SUPPLIER_WEBSITE || "letterstack.site",
  };
}

/**
 * Details worth filling in before this goes to many customers.
 *
 * Advisory only — nothing blocks on it. A registered address is what an
 * accounts department expects to see, but a missing one is a document that
 * looks sparse, not a document that is wrong.
 */
export function supplierSuggestions(value: Supplier = supplier()): string[] {
  const missing: string[] = [];
  if (!process.env.INVOICE_SUPPLIER_NAME) missing.push("INVOICE_SUPPLIER_NAME");
  if (value.addressLines.length === 0) missing.push("INVOICE_SUPPLIER_ADDRESS");
  return missing;
}

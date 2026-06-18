// Per-account sending identity: a branded subdomain of the SES-verified parent
// domain. Verifying letterstack.site in SES lets us send from any subdomain of
// it (e.g. ciba.letterstack.site) with no extra verification — DKIM signs as the
// parent domain and DMARC relaxed alignment passes for the subdomain.

/** The SES-verified parent domain, derived from MAIL_FROM (e.g. "letterstack.site"). */
export function baseSendingDomain(): string {
  const from = process.env.MAIL_FROM ?? "";
  return from.split("@")[1] ?? "letterstack.site";
}

/** The local part used on every branded address (newsletter@<slug>.<domain>). */
export const SENDING_LOCALPART = "newsletter";

/**
 * The From address for an account. With a slug → branded subdomain address;
 * without one → the shared verified default (MAIL_FROM).
 */
export function sendingAddressForSlug(slug: string | null | undefined): string {
  const base = baseSendingDomain();
  if (!slug) return process.env.MAIL_FROM ?? `${SENDING_LOCALPART}@${base}`;
  return `${SENDING_LOCALPART}@${slug}.${base}`;
}

/** Valid slug: lowercase letters/digits/hyphens, 1–40 chars, no edge hyphens. */
export const SENDING_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

export function isValidSlug(slug: string): boolean {
  return SENDING_SLUG_RE.test(slug);
}

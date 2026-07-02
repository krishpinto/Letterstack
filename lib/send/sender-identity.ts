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

/** Local part users may pick on their own domain (hello, updates, jobs…). */
export const FROM_LOCALPART_RE =
  /^[a-z0-9](?:[a-z0-9._+-]{0,62}[a-z0-9])?$/i;

/**
 * A campaign may only send from the shared verified address (MAIL_FROM) or
 * any local part on one of the organization's verified custom domains.
 */
export function isAllowedFromEmail(
  email: string,
  verifiedDomains: string[],
): boolean {
  if (email === (process.env.MAIL_FROM ?? "")) return email.length > 0;

  const at = email.lastIndexOf("@");
  if (at <= 0) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();

  return (
    FROM_LOCALPART_RE.test(local) &&
    verifiedDomains.some((d) => d.toLowerCase() === domain)
  );
}

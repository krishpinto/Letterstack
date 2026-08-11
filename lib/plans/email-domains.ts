// Which email domains say something about *who* a signup is, and which say
// nothing at all.
//
// The free period is tracked per domain so a workspace can't be abandoned and
// remade for another two months. That only works for domains a single
// organisation controls. Treating a public mailbox provider the same way
// would mean the first person to sign up with a Gmail address consumed the
// free period for every Gmail user on earth — so those are excluded, and
// those signups are held to the per-user and per-sending-domain checks
// instead.

const PUBLIC_EMAIL_PROVIDERS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.in",
  "yahoo.co.uk",
  "ymail.com",
  "rocketmail.com",
  "outlook.com",
  "hotmail.com",
  "hotmail.co.uk",
  "live.com",
  "msn.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "tutanota.com",
  "zoho.com",
  "zohomail.com",
  "yandex.com",
  "yandex.ru",
  "mail.com",
  "mail.ru",
  "gmx.com",
  "gmx.net",
  "fastmail.com",
  "hey.com",
  "duck.com",
  // Widely used in India, where most of our signups come from.
  "rediffmail.com",
  "rediff.com",
  "sify.com",
  "indiatimes.com",
]);

/** Lowercased domain part of an address, or null if it isn't one. */
export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return null;
  return email.slice(at + 1).trim().toLowerCase() || null;
}

export function isPublicEmailProvider(domain: string): boolean {
  return PUBLIC_EMAIL_PROVIDERS.has(domain.trim().toLowerCase());
}

/**
 * The email domain to hold against a free period, or null when the address
 * tells us nothing about which organisation this is. Null means "don't track
 * by email domain", never "allow anything".
 */
export function organizationEmailDomain(email: string): string | null {
  const domain = emailDomain(email);
  if (!domain || isPublicEmailProvider(domain)) return null;
  return domain;
}

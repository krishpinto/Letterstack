// Where customer replies should land.
//
// letterstack.site is verified in SES for *sending* and has no MX records, so
// nothing can be delivered to it — a reply to the From address is discarded by
// the sender's mail server with nobody the wiser. Any message that invites a
// reply therefore has to carry a Reply-To pointing somewhere real.
//
// Configuration only, with no fallback address. A hard-coded default would mean
// a self-hosted deployment quietly routing its customers' billing replies to
// this project's authors, which is the same trap the contact form had. Unset
// means no Reply-To header at all rather than the wrong one.

/**
 * Everyone who should see a reply, from SUPPORT_INBOX (comma-separated).
 * Falls back to CONTACT_INBOX so a deployment that has already configured a
 * destination for the contact form doesn't have to name it twice. Empty when
 * neither is set.
 */
export function supportInboxes(): string[] {
  const configured = process.env.SUPPORT_INBOX || process.env.CONTACT_INBOX || "";
  return configured
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);
}

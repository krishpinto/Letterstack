import crypto from "node:crypto";

/**
 * Unsubscribe link signing + content personalization.
 *
 * The compiled snapshot carries a `{{unsubscribe_url}}` placeholder (the same
 * for everyone — that's what gets frozen). At SEND time we mint a per-recipient
 * signed link and swap it into the HTML/text just before handing the email to
 * SES. The token is a tamper-proof claim of "(organization, email) asked to
 * leave", so the public unsubscribe route can suppress without a login and
 * without trusting anything in the URL.
 *
 * Token format:  base64url(JSON{o,u,e}).base64url(HMAC-SHA256(payload))
 *
 * `o` (the sending organization) was added later. Tokens minted before that
 * carry only `{u,e}` — the sender's user id — and a user can belong to several
 * workspaces, so those tokens can't say which one sent the mail. They are still
 * honoured (links in old emails must keep working); see
 * legacyUnsubscribeOrganizations for how they are resolved.
 */

const PLACEHOLDER = /\{\{unsubscribe_url\}\}/g;

function signingSecret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET || process.env.AUTH_SECRET;
  if (!s) {
    throw new Error(
      "UNSUBSCRIBE_SECRET (or AUTH_SECRET) must be set to sign unsubscribe links",
    );
  }
  return s;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function hmac(payload: string): string {
  return b64url(crypto.createHmac("sha256", signingSecret()).update(payload).digest());
}

export type UnsubscribeClaim = {
  /** The workspace that sent the email. Null only on tokens minted before it was recorded. */
  organizationId: string | null;
  /** The user the send is attributed to (stored on the suppression row). */
  userId: string;
  email: string;
};

/** Mint a signed unsubscribe token for one (sending org, recipient) pair. */
export function signUnsubscribeToken(
  organizationId: string,
  userId: string,
  email: string,
): string {
  const payload = b64url(
    Buffer.from(JSON.stringify({ o: organizationId, u: userId, e: email })),
  );
  return `${payload}.${hmac(payload)}`;
}

/** Verify a token and recover the claim, or null if it's been tampered with. */
export function verifyUnsubscribeToken(token: string): UnsubscribeClaim | null {
  const [payload, sig] = (token || "").split(".");
  if (!payload || !sig) return null;

  const expected = Buffer.from(hmac(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    return null;
  }

  try {
    const obj = JSON.parse(b64urlDecode(payload).toString("utf8"));
    if (typeof obj?.u === "string" && typeof obj?.e === "string") {
      return {
        organizationId: typeof obj.o === "string" && obj.o ? obj.o : null,
        userId: obj.u,
        email: obj.e,
      };
    }
  } catch {
    // fall through
  }
  return null;
}

/** The human-facing confirm page (clicked from the email body). */
export function unsubscribePageUrl(
  base: string,
  organizationId: string,
  userId: string,
  email: string,
): string {
  const token = signUnsubscribeToken(organizationId, userId, email);
  return `${base}/unsubscribe?t=${encodeURIComponent(token)}`;
}

/** The RFC 8058 one-click endpoint (POSTed directly by the mail provider). */
export function unsubscribeOneClickUrl(
  base: string,
  organizationId: string,
  userId: string,
  email: string,
): string {
  const token = signUnsubscribeToken(organizationId, userId, email);
  return `${base}/api/unsubscribe?t=${encodeURIComponent(token)}`;
}

/** Swap the `{{unsubscribe_url}}` placeholder for this recipient's real link. */
export function personalizeUnsubscribe(
  content: { html: string; text: string },
  pageUrl: string,
): { html: string; text: string } {
  return {
    html: content.html.replace(PLACEHOLDER, pageUrl),
    text: content.text.replace(PLACEHOLDER, pageUrl),
  };
}

/**
 * Which workspaces a legacy (organization-less) token should suppress in.
 *
 * The token only names the sending user, who may belong to several
 * workspaces. Suppressing in the user's oldest one — what this used to do —
 * meant an unsubscribe from workspace B landed in A and B kept mailing. So
 * suppress everywhere the address could plausibly have been mailed from:
 * every workspace where that user sent a campaign to it, and every workspace
 * that holds it as a contact and either has the user as a member or had the
 * contact added by them (automation sends are attributed to the contact's
 * owner). Over-suppressing is the safe direction: a missed unsubscribe is a
 * CAN-SPAM problem, an extra one is a contact who can re-subscribe.
 *
 * If none of those match (a test send to the owner's own inbox, say), fall
 * back to every workspace the user is in, so the request is never dropped.
 */
export function legacyUnsubscribeOrganizations(sources: {
  campaignOrganizationIds: string[];
  recipientOrganizationIds: string[];
  memberOrganizationIds: string[];
}): string[] {
  const matched = new Set([
    ...sources.campaignOrganizationIds,
    ...sources.recipientOrganizationIds,
  ]);
  if (matched.size > 0) return [...matched];
  return [...new Set(sources.memberOrganizationIds)];
}

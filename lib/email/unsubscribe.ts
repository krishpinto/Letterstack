import crypto from "node:crypto";

/**
 * Unsubscribe link signing + content personalization.
 *
 * The compiled snapshot carries a `{{unsubscribe_url}}` placeholder (the same
 * for everyone — that's what gets frozen). At SEND time we mint a per-recipient
 * signed link and swap it into the HTML/text just before handing the email to
 * SES. The token is a tamper-proof claim of "(userId, email) asked to leave",
 * so the public unsubscribe route can suppress without a login and without
 * trusting anything in the URL.
 *
 * Token format:  base64url(JSON{u,e}).base64url(HMAC-SHA256(payload))
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

/** Mint a signed unsubscribe token for one (owner, recipient) pair. */
export function signUnsubscribeToken(userId: string, email: string): string {
  const payload = b64url(Buffer.from(JSON.stringify({ u: userId, e: email })));
  return `${payload}.${hmac(payload)}`;
}

/** Verify a token and recover the claim, or null if it's been tampered with. */
export function verifyUnsubscribeToken(token: string): { userId: string; email: string } | null {
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
      return { userId: obj.u, email: obj.e };
    }
  } catch {
    // fall through
  }
  return null;
}

/** The human-facing confirm page (clicked from the email body). */
export function unsubscribePageUrl(base: string, userId: string, email: string): string {
  return `${base}/unsubscribe?t=${encodeURIComponent(signUnsubscribeToken(userId, email))}`;
}

/** The RFC 8058 one-click endpoint (POSTed directly by the mail provider). */
export function unsubscribeOneClickUrl(base: string, userId: string, email: string): string {
  return `${base}/api/unsubscribe?t=${encodeURIComponent(signUnsubscribeToken(userId, email))}`;
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

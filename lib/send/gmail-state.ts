// The OAuth `state` for the Gmail connect flow, kept free of I/O so it can be
// unit tested.
//
// state = base64url(JSON payload) + "." + HMAC-SHA256(payload), keyed by
// AUTH_SECRET. The signature stops forgery. On its own it does not stop a
// login-CSRF style swap: an attacker could start the flow in their own
// browser, keep the signed state, and trick a victim's browser into
// finishing it, attaching the attacker's mailbox to the victim's workspace
// (or the reverse). So the payload also carries:
//   - n: a random nonce, also stored in an httpOnly cookie by /connect; the
//        callback requires the two to match, which only the browser that
//        started the flow can do.
//   - t: when it was issued; the callback rejects anything older than
//        GMAIL_STATE_MAX_AGE_MS, so a leaked state stops working quickly.
// The callback separately requires the signed-in user to be the user in the
// state, and still a member of its workspace.

import crypto from "node:crypto";

export const GMAIL_STATE_MAX_AGE_MS = 10 * 60 * 1000;
export const GMAIL_NONCE_COOKIE = "ls_gmail_oauth_nonce";

export type GmailStateClaim = {
  userId: string;
  organizationId: string;
  nonce: string;
  issuedAt: number;
};

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sign(payload: string, secret: string): string {
  return b64url(crypto.createHmac("sha256", secret).update(payload).digest());
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function newGmailNonce(): string {
  return b64url(crypto.randomBytes(16));
}

export function signGmailState(claim: GmailStateClaim, secret: string): string {
  const payload = b64url(
    Buffer.from(
      JSON.stringify({
        u: claim.userId,
        o: claim.organizationId,
        n: claim.nonce,
        t: claim.issuedAt,
      }),
    ),
  );
  return `${payload}.${sign(payload, secret)}`;
}

/**
 * The claim inside a state, or null if it is forged, malformed, or older
 * than GMAIL_STATE_MAX_AGE_MS (or dated in the future, beyond a minute of
 * clock skew). Does NOT check the nonce cookie or the session: the callback
 * does that, because it has them.
 */
export function verifyGmailState(
  state: string,
  secret: string,
  now: number = Date.now(),
): GmailStateClaim | null {
  const [payload, sig, extra] = (state || "").split(".");
  if (!payload || !sig || extra !== undefined) return null;
  if (!safeEqual(sign(payload, secret), sig)) return null;

  let obj: unknown;
  try {
    obj = JSON.parse(b64urlDecode(payload).toString("utf8"));
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const { u, o, n, t } = obj as Record<string, unknown>;
  if (
    typeof u !== "string" ||
    typeof o !== "string" ||
    typeof n !== "string" ||
    !n ||
    typeof t !== "number"
  ) {
    return null;
  }

  const age = now - t;
  if (age > GMAIL_STATE_MAX_AGE_MS || age < -60_000) return null;

  return { userId: u, organizationId: o, nonce: n, issuedAt: t };
}

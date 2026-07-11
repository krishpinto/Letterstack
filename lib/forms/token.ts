import crypto from "node:crypto";

/**
 * Signed confirm tokens for double opt-in newsletter signups.
 *
 * A form submission does NOT write a pending row anywhere — instead we mint a
 * tamper-proof token carrying the claim "(formId, email, name) asked to
 * subscribe" and email it as a confirm link. Only when that link is clicked do
 * we add the address to `recipients`. So an unconfirmed signup never touches the
 * send path, and there's no pending state to expire or clean up (the token
 * carries its own issued-at and expires on its own).
 *
 * Same HMAC scheme as the unsubscribe links (lib/email/unsubscribe.ts):
 *   base64url(JSON{f,e,n,t}).base64url(HMAC-SHA256(payload))
 */

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type SubscribeClaim = {
  formId: string;
  email: string;
  name: string | null;
};

function signingSecret(): string {
  const s = process.env.SUBSCRIBE_SECRET || process.env.AUTH_SECRET;
  if (!s) {
    throw new Error(
      "SUBSCRIBE_SECRET (or AUTH_SECRET) must be set to sign subscribe confirm links",
    );
  }
  return s;
}

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function hmac(payload: string): string {
  return b64url(
    crypto.createHmac("sha256", signingSecret()).update(payload).digest(),
  );
}

/** Mint a signed confirm token for one pending signup. */
export function signSubscribeToken(claim: SubscribeClaim): string {
  const payload = b64url(
    Buffer.from(
      JSON.stringify({
        f: claim.formId,
        e: claim.email,
        n: claim.name ?? "",
        t: Date.now(),
      }),
    ),
  );
  return `${payload}.${hmac(payload)}`;
}

/** Verify a token and recover the claim, or null if tampered/expired. */
export function verifySubscribeToken(token: string): SubscribeClaim | null {
  const [payload, sig] = (token || "").split(".");
  if (!payload || !sig) return null;

  const expected = Buffer.from(hmac(payload));
  const given = Buffer.from(sig);
  if (
    expected.length !== given.length ||
    !crypto.timingSafeEqual(expected, given)
  ) {
    return null;
  }

  try {
    const obj = JSON.parse(b64urlDecode(payload).toString("utf8"));
    if (
      typeof obj?.f === "string" &&
      typeof obj?.e === "string" &&
      typeof obj?.t === "number"
    ) {
      if (Date.now() - obj.t > MAX_AGE_MS) return null;
      return {
        formId: obj.f,
        email: obj.e,
        name: typeof obj.n === "string" && obj.n ? obj.n : null,
      };
    }
  } catch {
    // fall through
  }
  return null;
}

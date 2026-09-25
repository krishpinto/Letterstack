/**
 * Minting, hashing and reading API keys.
 *
 * The raw key exists exactly twice: once in the response that creates it,
 * and once in whatever the customer pastes it into. We store only its
 * sha256, so a dump of `api_keys` cannot be replayed against the API —
 * the same shape as passwordResets.tokenHash and organizationInvites.tokenHash.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Leading segment of every key.
 *
 * Two jobs. A human scanning a config file can tell whose key it is, and —
 * the reason it's a fixed, greppable string — a secret scanner can match it.
 * Registering this pattern with GitHub secret scanning is what turns an
 * accidental commit into an alert instead of a breach.
 *
 * `live` leaves room for a `ls_test_` tier later that can never send real mail.
 */
export const API_KEY_PREFIX = "ls_live";

/** 32 bytes of CSPRNG output — 256 bits, far past anything brute-forceable. */
const SECRET_BYTES = 32;

export type GeneratedApiKey = {
  /** Shown to the user once and never stored. */
  key: string;
  hash: string;
  prefix: string;
  lastFour: string;
};

export function generateApiKey(): GeneratedApiKey {
  const secret = randomBytes(SECRET_BYTES).toString("base64url");
  const key = `${API_KEY_PREFIX}_${secret}`;

  return {
    key,
    hash: hashApiKey(key),
    prefix: API_KEY_PREFIX,
    lastFour: secret.slice(-4),
  };
}

/**
 * Unsalted sha256, deliberately.
 *
 * bcrypt is the right answer for passwords because they are low-entropy and
 * human-chosen, so the defence is making each guess slow. An API key has no
 * guessable structure, so slow hashing buys nothing — and a per-row salt
 * would make authentication a full table scan with a bcrypt compare per row
 * instead of one indexed lookup.
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/** Constant-time compare, for the rare path that compares two digests. */
export function digestsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * The key out of an `Authorization: Bearer …` header.
 *
 * Header only — never a query parameter. Query strings land in access logs,
 * browser history and Referer headers, which is how keys leak.
 */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}

/** What a key looks like in a list: `ls_live_…a1b2`. Never the whole thing. */
export function maskedKey(prefix: string, lastFour: string): string {
  return `${prefix}_…${lastFour}`;
}

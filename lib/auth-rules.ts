// Account rules with no I/O, kept apart from lib/auth.ts so they can be unit
// tested without NextAuth or a database.

/** One minimum for signup, reset and change, enforced server-side in each. */
export const MIN_PASSWORD_LENGTH = 8;

/** bcrypt cost for every new password hash. */
export const BCRYPT_COST = 12;

/** The per-user auth state the jwt callback re-reads on every request. */
export type AuthState = {
  email: string;
  emailVerifiedAt: Date | null;
  sessionVersion: number;
};

/**
 * Whether a session token is still good for this account.
 *
 * Tokens issued before session versions existed carry none; they count as
 * version 0, which is the column default, so the deploy that introduced this
 * signed nobody out. A missing account (deleted) is never current.
 */
export function sessionIsCurrent(
  tokenVersion: number | undefined,
  state: AuthState | null,
): boolean {
  if (!state) return false;
  return (tokenVersion ?? 0) === state.sessionVersion;
}

export type GoogleClaim =
  | { kind: "create" }
  | { kind: "link"; backfillName: boolean }
  | { kind: "takeover"; backfillName: boolean };

/**
 * What a Google sign-in should do to the account with the same email.
 *
 * Google only reaches here with an address it has verified, so Google is
 * proof the person owns the mailbox. If the existing account never proved
 * that, someone else may have registered it first, knowing the owner would
 * arrive later through Google ("pre-hijacking"). So the owner takes it over:
 * the account is marked verified, the password nobody proved they own is
 * removed, and every session that password produced is revoked. An account
 * that already proved ownership is simply linked.
 */
export function planGoogleClaim(
  existing: { emailVerifiedAt: Date | null; name: string | null } | null,
  googleName: string | null,
): GoogleClaim {
  if (!existing) return { kind: "create" };
  const backfillName = !existing.name && Boolean(googleName);
  if (!existing.emailVerifiedAt) return { kind: "takeover", backfillName };
  return { kind: "link", backfillName };
}

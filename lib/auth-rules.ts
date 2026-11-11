// Account rules with no I/O, kept apart from lib/auth.ts so they can be unit
// tested without NextAuth or a database.

/** One minimum for signup, reset and change, enforced server-side in each. */
export const MIN_PASSWORD_LENGTH = 8;

/** bcrypt cost for every new password hash. */
export const BCRYPT_COST = 12;

/** The per-user auth state the jwt callback re-reads on every request. */
export type AuthState = {
  email: string;
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

// Account rules with no I/O, kept apart from lib/auth.ts so they can be unit
// tested without NextAuth or a database.

/** One minimum for signup, reset and change, enforced server-side in each. */
export const MIN_PASSWORD_LENGTH = 8;

/** bcrypt cost for every new password hash. */
export const BCRYPT_COST = 12;

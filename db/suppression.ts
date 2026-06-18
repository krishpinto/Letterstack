import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "./client";
import { suppressedEmails } from "./schema";

/**
 * The do-not-mail logic. Now per-user: each account keeps its own list, so one
 * user's unsubscribes/bounces never show up in another's. The send path and the
 * webhook both go through these, always scoped to a `userId`.
 */

/** Add an address to a user's do-not-mail list. Safe to call twice. */
export async function suppressEmail(userId: string, email: string, reason: string) {
  await db
    .insert(suppressedEmails)
    .values({ userId, email, reason })
    .onConflictDoNothing(); // already suppressed for this user? no-op
}

/** Is this address on THIS user's do-not-mail list? Checked before every send. */
export async function isSuppressed(userId: string, email: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(suppressedEmails)
    .where(and(eq(suppressedEmails.userId, userId), eq(suppressedEmails.email, email)))
    .limit(1);
  return rows.length > 0;
}

/** Read this user's whole list (newest first) — for the contacts/suppression UI. */
export async function listSuppressedEmails(userId: string) {
  return db
    .select()
    .from(suppressedEmails)
    .where(eq(suppressedEmails.userId, userId))
    .orderBy(desc(suppressedEmails.createdAt));
}

/** This user's emails that bounced or complained — to flag them in a campaign. */
export async function listBouncedEmails(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ email: suppressedEmails.email })
    .from(suppressedEmails)
    .where(
      and(
        eq(suppressedEmails.userId, userId),
        inArray(suppressedEmails.reason, ["bounce", "complaint"]),
      ),
    );
  return new Set(rows.map((r) => r.email));
}

/** This user's full suppressed-address set — used by freezeAudience. */
export async function listSuppressedSet(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ email: suppressedEmails.email })
    .from(suppressedEmails)
    .where(eq(suppressedEmails.userId, userId));
  return new Set(rows.map((r) => r.email));
}

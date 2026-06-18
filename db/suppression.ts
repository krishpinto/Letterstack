import { desc, eq, inArray } from "drizzle-orm";
import { db } from "./client";
import { suppressedEmails } from "./schema";

/** The real do-not-mail logic. The send path and the webhook both use this. */

/** Add an address to the do-not-mail list. Safe to call twice (no duplicates). */
export async function suppressEmail(email: string, reason: string) {
  await db
    .insert(suppressedEmails)
    .values({ email, reason })
    .onConflictDoNothing(); // already suppressed? do nothing, no error
}

/** Is this address on the do-not-mail list? Checked before every send. */
export async function isSuppressed(email: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(suppressedEmails)
    .where(eq(suppressedEmails.email, email))
    .limit(1);
  return rows.length > 0;
}

/** Read the whole list (newest first) — for the lab card. */
export async function listSuppressedEmails() {
  return db.select().from(suppressedEmails).orderBy(desc(suppressedEmails.createdAt));
}

/** The set of emails that bounced or complained — to flag them in a campaign. */
export async function listBouncedEmails(): Promise<Set<string>> {
  const rows = await db
    .select({ email: suppressedEmails.email })
    .from(suppressedEmails)
    .where(inArray(suppressedEmails.reason, ["bounce", "complaint"]));
  return new Set(rows.map((r) => r.email));
}

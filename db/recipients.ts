import { desc } from "drizzle-orm";
import { db } from "./client";
import { recipients } from "./schema";

/**
 * The real, keep-forever logic for the `recipients` table. The /lab card only
 * CALLS these — it doesn't know how the database works. When /lab is deleted,
 * these functions stay, and the real "Send campaign" flow will reuse them.
 */

/** Write: add one person to the recipients table, return the saved row. */
export async function addRecipient(input: { email: string; name?: string }) {
  const [row] = await db
    .insert(recipients)
    .values({ email: input.email, name: input.name ?? null })
    .returning(); // give us back the row the database created (with id + time)
  return row;
}

/** Read: get everyone, newest first. */
export async function listRecipients() {
  return db.select().from(recipients).orderBy(desc(recipients.createdAt));
}

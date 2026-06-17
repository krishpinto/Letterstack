import { desc, eq, isNull } from "drizzle-orm";
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

/** Read: only people we HAVEN'T emailed yet (sentAt is still null). */
export async function listUnsentRecipients() {
  return db
    .select()
    .from(recipients)
    .where(isNull(recipients.sentAt)) // the WHERE clause: "where sent_at is empty"
    .orderBy(desc(recipients.createdAt));
}

/** Write: tick one person off the checklist by stamping them with the time. */
export async function markRecipientSent(id: string) {
  await db
    .update(recipients)
    .set({ sentAt: new Date() })
    .where(eq(recipients.id, id)); // only this one person (matched by id)
}

/** Write: clear every stamp — a testing helper so we can re-send the demo. */
export async function resetSentFlags() {
  await db.update(recipients).set({ sentAt: null });
}

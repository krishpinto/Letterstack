import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "./client";
import { recipients } from "./schema";

/**
 * The real, keep-forever logic for the `recipients` table. Every function is
 * scoped to a `userId` — a user only ever reads or writes their OWN audience.
 * (Functions that take an `id` already came from a user-scoped read, so they
 * stay keyed by id.)
 */

/** Write: add one person to this user's audience, return the saved row. */
export async function addRecipient(
  userId: string,
  input: { email: string; name?: string },
) {
  const [row] = await db
    .insert(recipients)
    .values({ userId, email: input.email, name: input.name ?? null })
    .returning();
  return row;
}

/** Read: this user's whole list, newest first. */
export async function listRecipients(userId: string) {
  return db
    .select()
    .from(recipients)
    .where(eq(recipients.userId, userId))
    .orderBy(desc(recipients.createdAt));
}

/** Read: this user's people we HAVEN'T emailed yet (sentAt is still null). */
export async function listUnsentRecipients(userId: string) {
  return db
    .select()
    .from(recipients)
    .where(and(eq(recipients.userId, userId), isNull(recipients.sentAt)))
    .orderBy(desc(recipients.createdAt));
}

/**
 * Read: of a specific set of people (one QStash batch), which are STILL unsent.
 * The worker calls this before sending, so a retried batch skips anyone already
 * done. The ids came from a user-scoped freeze, so this stays keyed by id.
 */
export async function listUnsentByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(recipients)
    .where(and(inArray(recipients.id, ids), isNull(recipients.sentAt)));
}

/** Write: tick one person off the checklist by stamping them with the time. */
export async function markRecipientSent(id: string) {
  await db.update(recipients).set({ sentAt: new Date() }).where(eq(recipients.id, id));
}

/** Write: clear this user's stamps — a testing helper so we can re-send. */
export async function resetSentFlags(userId: string) {
  await db.update(recipients).set({ sentAt: null }).where(eq(recipients.userId, userId));
}

/** Remove one recipient from THIS user's audience (can't touch others'). */
export async function deleteRecipient(userId: string, id: string) {
  await db
    .delete(recipients)
    .where(and(eq(recipients.id, id), eq(recipients.userId, userId)));
}

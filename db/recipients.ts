import { and, desc, eq } from "drizzle-orm";
import { db } from "./client";
import { recipients } from "./schema";

const INSERT_BATCH_SIZE = 1_000;

type AudiencePerson = {
  email: string;
  name?: string | null;
};

export async function addRecipient(
  organizationId: string,
  userId: string,
  input: AudiencePerson,
) {
  const [row] = await db
    .insert(recipients)
    .values({
      organizationId,
      userId,
      email: input.email,
      name: input.name ?? null,
    })
    .onConflictDoNothing({
      target: [recipients.organizationId, recipients.email],
    })
    .returning();

  return row ?? null;
}

export async function addRecipientsBulk(
  organizationId: string,
  userId: string,
  people: AudiencePerson[],
) {
  const inserted: (typeof recipients.$inferSelect)[] = [];

  for (let index = 0; index < people.length; index += INSERT_BATCH_SIZE) {
    const batch = people.slice(index, index + INSERT_BATCH_SIZE);
    if (batch.length === 0) continue;

    const rows = await db
      .insert(recipients)
      .values(
        batch.map((person) => ({
          organizationId,
          userId,
          email: person.email,
          name: person.name ?? null,
        })),
      )
      .onConflictDoNothing({
        target: [recipients.organizationId, recipients.email],
      })
      .returning();

    inserted.push(...rows);
  }

  return inserted;
}

/** True if this email is already in the org's audience (any status). */
export async function recipientExists(
  organizationId: string,
  email: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: recipients.id })
    .from(recipients)
    .where(
      and(
        eq(recipients.organizationId, organizationId),
        eq(recipients.email, email),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

export async function listRecipientsForOrganization(organizationId: string) {
  return db
    .select()
    .from(recipients)
    .where(eq(recipients.organizationId, organizationId))
    .orderBy(desc(recipients.createdAt));
}

export async function resetSentFlags(organizationId: string) {
  await db
    .update(recipients)
    .set({ sentAt: null })
    .where(eq(recipients.organizationId, organizationId));
}

export async function updateRecipient(
  organizationId: string,
  id: string,
  patch: { email?: string; name?: string | null },
) {
  const values: Partial<typeof recipients.$inferInsert> = {};
  if (patch.email !== undefined) values.email = patch.email;
  if (patch.name !== undefined) values.name = patch.name;
  if (Object.keys(values).length === 0) return null;

  const [row] = await db
    .update(recipients)
    .set(values)
    .where(
      and(
        eq(recipients.id, id),
        eq(recipients.organizationId, organizationId),
      ),
    )
    .returning();

  return row ?? null;
}

export async function deleteRecipient(organizationId: string, id: string) {
  const rows = await db
    .delete(recipients)
    .where(
      and(
        eq(recipients.id, id),
        eq(recipients.organizationId, organizationId),
      ),
    )
    .returning({ id: recipients.id });

  return rows.length > 0;
}
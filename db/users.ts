import { eq } from "drizzle-orm";
import { db } from "./client";
import { users } from "./schema";

/** The account's branded sending subdomain slug, or null if not set yet. */
export async function getSendingSlug(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ slug: users.sendingSlug })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.slug ?? null;
}

/** Set (or change) the account's sending subdomain slug. */
export async function setSendingSlug(userId: string, slug: string): Promise<void> {
  await db.update(users).set({ sendingSlug: slug }).where(eq(users.id, userId));
}

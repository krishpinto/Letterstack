import { eq, sql } from "drizzle-orm";
import { db } from "./client";
import { organizationMembers, organizations, users } from "./schema";

/** Thrown when deleting the account would orphan a shared workspace. */
export class SoleOwnerError extends Error {
  constructor(public organizationNames: string[]) {
    super(
      `Sole owner of ${organizationNames.length} workspace(s) with other members`,
    );
    this.name = "SoleOwnerError";
  }
}

export async function getUserProfile(userId: string) {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

/** Has this person already been shown the free-Pro-trial announcement? */
export async function hasSeenPlanNotice(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ seenAt: users.planNoticeSeenAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return Boolean(row?.seenAt);
}

/**
 * Record that the announcement was dismissed. Written once and never
 * cleared — re-announcing something someone already acknowledged reads as a
 * bug, not a reminder. The trial-ending warning is a separate, recurring
 * surface precisely so this one can stay a single event.
 */
export async function markPlanNoticeSeen(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ planNoticeSeenAt: new Date() })
    .where(eq(users.id, userId));
}

export async function updateUserName(userId: string, name: string) {
  const [row] = await db
    .update(users)
    .set({ name })
    .where(eq(users.id, userId))
    .returning({ id: users.id, name: users.name, email: users.email });
  return row ?? null;
}

/**
 * Delete a user's account. Refuses if the user is the sole owner of a
 * workspace that has other members (that membership can't just vanish —
 * someone else needs to own it first). Workspaces the user owns AND is the
 * only member of are deleted along with everything scoped to them
 * (cascades through organizationId foreign keys).
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  const memberships = await db
    .select({
      organizationId: organizationMembers.organizationId,
      role: organizationMembers.role,
      name: organizations.name,
      memberCount: sql<number>`(select count(*)::int from organization_members om where om.organization_id = organizations.id)`.as(
        "member_count",
      ),
    })
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizationMembers.organizationId, organizations.id),
    )
    .where(eq(organizationMembers.userId, userId));

  const blocking = memberships.filter(
    (m) => m.role === "owner" && m.memberCount > 1,
  );
  if (blocking.length > 0) {
    throw new SoleOwnerError(blocking.map((m) => m.name));
  }

  const soloOwnedOrgIds = memberships
    .filter((m) => m.role === "owner" && m.memberCount === 1)
    .map((m) => m.organizationId);

  for (const organizationId of soloOwnedOrgIds) {
    await db.delete(organizations).where(eq(organizations.id, organizationId));
  }

  await db.delete(users).where(eq(users.id, userId));
}

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

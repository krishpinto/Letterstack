import { and, asc, eq } from "drizzle-orm";
import { db } from "./client";
import { organizationMembers, organizations, users } from "./schema";

export type OrganizationType = "personal" | "business";

/** Thrown when the caller's user row no longer exists (e.g. a stale session). */
export class OwnerNotFoundError extends Error {
  constructor() {
    super("Owner account not found");
    this.name = "OwnerNotFoundError";
  }
}

export function normalizeOrganizationType(value: unknown): OrganizationType {
  return value === "personal" ? "personal" : "business";
}

function organizationSelect() {
  return {
    id: organizations.id,
    name: organizations.name,
    type: organizations.type,
    role: organizationMembers.role,
    createdAt: organizations.createdAt,
  };
}

export async function getDefaultOrganizationForUser(userId: string) {
  const [row] = await db
    .select(organizationSelect())
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizationMembers.organizationId, organizations.id),
    )
    .where(eq(organizationMembers.userId, userId))
    .orderBy(asc(organizationMembers.createdAt))
    .limit(1);

  return row ?? null;
}

export async function getOrganizationForUser(
  userId: string,
  organizationId: string,
) {
  const [row] = await db
    .select(organizationSelect())
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizationMembers.organizationId, organizations.id),
    )
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizations.id, organizationId),
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function getActiveOrganizationForUser(
  userId: string,
  organizationId?: string | null,
) {
  if (organizationId) {
    const organization = await getOrganizationForUser(userId, organizationId);
    if (organization) return organization;
  }

  return getDefaultOrganizationForUser(userId);
}

export async function listOrganizationsForUser(userId: string) {
  return db
    .select(organizationSelect())
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizationMembers.organizationId, organizations.id),
    )
    .where(eq(organizationMembers.userId, userId))
    .orderBy(asc(organizationMembers.createdAt));
}

export async function createOrganizationForUser(
  userId: string,
  input: { name: string; type: OrganizationType },
) {
  // organization_members has a foreign key to users.id. If the caller's account
  // no longer exists (a session outliving its user row), that insert fails AFTER
  // the org is created, leaving a member-less orphan. Check the owner up front so
  // we never create something we can't finish.
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!owner) throw new OwnerNotFoundError();

  const [organization] = await db
    .insert(organizations)
    .values({
      name: input.name,
      type: input.type,
    })
    .returning({
      id: organizations.id,
      name: organizations.name,
      type: organizations.type,
      createdAt: organizations.createdAt,
    });

  try {
    await db.insert(organizationMembers).values({
      organizationId: organization.id,
      userId,
      role: "owner",
    });
  } catch (error) {
    // neon-http is stateless (no interactive transactions), so undo the org
    // insert by hand rather than leaving an orphan behind.
    await db.delete(organizations).where(eq(organizations.id, organization.id));
    throw error;
  }

  return { ...organization, role: "owner" };
}
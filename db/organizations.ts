import { and, asc, eq } from "drizzle-orm";
import { db } from "./client";
import { organizationMembers, organizations } from "./schema";

export type OrganizationType = "personal" | "business";

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

  await db.insert(organizationMembers).values({
    organizationId: organization.id,
    userId,
    role: "owner",
  });

  return { ...organization, role: "owner" };
}
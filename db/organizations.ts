import { and, asc, eq, sql } from "drizzle-orm";
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

// Beta-phase ceiling on total marketing email volume per organization
// (campaigns + automations combined). Flat during beta — no plans/tiers yet.
export const BETA_EMAIL_SEND_CAP = 5000;

/**
 * Atomically reserve `count` sends against the org's beta cap. Returns true
 * (and commits the reservation) only if the org has enough headroom left;
 * returns false — reserving nothing — if it would push the org over the cap.
 * A single guarded UPDATE, so concurrent QStash workers can't both "pass" the
 * check and jointly overshoot the limit.
 */
export async function tryReserveSendQuota(
  organizationId: string,
  count: number,
): Promise<boolean> {
  if (count <= 0) return true;
  const [row] = await db
    .update(organizations)
    .set({ emailsSentCount: sql`${organizations.emailsSentCount} + ${count}` })
    .where(
      and(
        eq(organizations.id, organizationId),
        sql`${organizations.emailsSentCount} + ${count} <= ${BETA_EMAIL_SEND_CAP}`,
      ),
    )
    .returning({ emailsSentCount: organizations.emailsSentCount });
  return Boolean(row);
}

/** Current usage against the beta send cap, for display in Billing settings. */
export async function getSendUsage(organizationId: string) {
  const [row] = await db
    .select({ used: organizations.emailsSentCount })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return { used: row?.used ?? 0, limit: BETA_EMAIL_SEND_CAP };
}

function organizationSelect() {
  return {
    id: organizations.id,
    name: organizations.name,
    type: organizations.type,
    role: organizationMembers.role,
    // Hand-qualified: an interpolated column would render unqualified and
    // silently resolve against `om` inside the subquery.
    memberCount: sql<number>`(select count(*)::int from organization_members om where om.organization_id = organizations.id)`.as(
      "member_count",
    ),
    plan: organizations.plan,
    planExpiresAt: organizations.planExpiresAt,
    createdAt: organizations.createdAt,
  };
}

/**
 * The plan actually in force right now. Stored `plan` alone isn't enough —
 * a paid period that has run out should read as free everywhere without
 * needing a cron job to sweep expired rows.
 */
export function activePlan(org: {
  plan?: string | null;
  planExpiresAt?: Date | string | null;
}): "free" | "pro" {
  if (org.plan !== "pro") return "free";
  if (!org.planExpiresAt) return "pro";
  const expires = new Date(org.planExpiresAt);
  return expires.getTime() > Date.now() ? "pro" : "free";
}

/**
 * Start or extend a paid period. Extends from whichever is later — the
 * current expiry or now — so buying again mid-period adds to the remaining
 * time instead of throwing it away.
 */
export async function activatePlanForOrganization(
  organizationId: string,
  plan: string,
  days: number,
) {
  const [current] = await db
    .select({ planExpiresAt: organizations.planExpiresAt, plan: organizations.plan })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  const now = Date.now();
  const currentExpiry =
    current && activePlan(current) !== "free" && current.planExpiresAt
      ? new Date(current.planExpiresAt).getTime()
      : now;
  const base = Math.max(now, currentExpiry);
  const expiresAt = new Date(base + days * 24 * 60 * 60 * 1000);

  const [row] = await db
    .update(organizations)
    .set({ plan, planExpiresAt: expiresAt })
    .where(eq(organizations.id, organizationId))
    .returning({ plan: organizations.plan, planExpiresAt: organizations.planExpiresAt });
  return row ?? null;
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

  // Duplicate names among this user's workspaces get a numeric suffix
  // ("Acme" → "Acme 2") so the switcher never shows two identical entries.
  const taken = new Set(
    (await listOrganizationsForUser(userId)).map((org) =>
      org.name.trim().toLowerCase(),
    ),
  );
  let name = input.name;
  if (taken.has(name.toLowerCase())) {
    let suffix = 2;
    while (taken.has(`${name} ${suffix}`.toLowerCase())) suffix += 1;
    name = `${name} ${suffix}`;
  }

  const [organization] = await db
    .insert(organizations)
    .values({
      name,
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

  return { ...organization, role: "owner", memberCount: 1 };
}

/** Thrown when a caller without the required role tries to act on an org. */
export class NotOrganizationOwnerError extends Error {
  constructor() {
    super("Only the workspace owner can do this");
    this.name = "NotOrganizationOwnerError";
  }
}

/** The caller's role in an organization, or null if they aren't a member. */
export async function getMemberRole(userId: string, organizationId: string) {
  const [row] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId),
      ),
    )
    .limit(1);
  return row?.role ?? null;
}

/** Rename a workspace / change its type. Owner-only, enforced by caller. */
export async function updateOrganization(
  organizationId: string,
  input: { name: string; type: OrganizationType },
) {
  const [organization] = await db
    .update(organizations)
    .set({ name: input.name, type: input.type })
    .where(eq(organizations.id, organizationId))
    .returning({
      id: organizations.id,
      name: organizations.name,
      type: organizations.type,
      createdAt: organizations.createdAt,
    });
  return organization ?? null;
}

/** Every member of a workspace, newest last. */
export async function listOrganizationMembers(organizationId: string) {
  return db
    .select({
      id: organizationMembers.id,
      userId: organizationMembers.userId,
      role: organizationMembers.role,
      joinedAt: organizationMembers.createdAt,
      name: users.name,
      email: users.email,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .where(eq(organizationMembers.organizationId, organizationId))
    .orderBy(asc(organizationMembers.createdAt));
}

/** Thrown when a removal would leave a workspace without an owner. */
export class CannotRemoveSoleOwnerError extends Error {
  constructor() {
    super("The workspace needs at least one owner");
    this.name = "CannotRemoveSoleOwnerError";
  }
}

export class NotFoundInOrganizationError extends Error {
  constructor() {
    super("That member isn't part of this workspace");
    this.name = "NotFoundInOrganizationError";
  }
}

/**
 * Remove a member. Owners can remove anyone but themselves; a member can
 * remove only themselves (leaving). The sole owner can never be removed —
 * delete the workspace instead.
 */
export async function removeOrganizationMember(
  organizationId: string,
  memberId: string,
  requesterUserId: string,
  requesterRole: string,
) {
  const [target] = await db
    .select({
      id: organizationMembers.id,
      userId: organizationMembers.userId,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.id, memberId),
        eq(organizationMembers.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!target) throw new NotFoundInOrganizationError();

  const actingOnSelf = target.userId === requesterUserId;
  if (!actingOnSelf && requesterRole !== "owner") {
    throw new NotOrganizationOwnerError();
  }
  if (target.role === "owner") {
    throw new CannotRemoveSoleOwnerError();
  }

  await db.delete(organizationMembers).where(eq(organizationMembers.id, memberId));
}

/** Delete a workspace and everything scoped to it. Owner-only. */
export async function deleteOrganization(organizationId: string) {
  await db.delete(organizations).where(eq(organizations.id, organizationId));
}
import {
  type Column,
  eq,
  getTableColumns,
  getTableName,
  sql,
  type Table,
} from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { PgTable } from "drizzle-orm/pg-core";

import {
  type AccountDeletionPlan,
  planAccountDeletion,
  REASSIGNED_TO_OWNER,
} from "./account-deletion";
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
 * Delete a user's account.
 *
 * Refuses if the user owns a workspace that has other members (someone else
 * needs to own it first). Workspaces the user owns and is the only member of
 * are deleted along with everything scoped to them.
 *
 * Everything the user created in any other workspace stays there: contacts,
 * campaigns, signup forms, automations and API keys are handed to that
 * workspace's owner (REASSIGNED_TO_OWNER), and payments and suppression rows
 * just stop naming the user (their FKs are SET NULL). That includes
 * workspaces the user has already left — their rows are still in them.
 *
 * All of it runs as one batch, which neon-http executes as a single
 * transaction: a failure part-way leaves nothing deleted and nothing
 * reassigned.
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

  const plan = planAccountDeletion(memberships);
  if (plan.blockingOrganizationNames.length > 0) {
    throw new SoleOwnerError(plan.blockingOrganizationNames);
  }

  const [first, ...rest] = accountDeletionStatements(userId, plan);
  await db.batch([first, ...rest]);
}

/**
 * The statements deleteUserAccount runs, in order. Built without touching
 * the database, so their SQL can be checked in a unit test.
 *
 * Order matters. Solo workspaces go first, so their rows are deleted with
 * them rather than handed to a successor that doesn't exist; every row still
 * pointing at the user after that is in somebody else's workspace. The user
 * row goes last, once nothing RESTRICTs it.
 */
export function accountDeletionStatements(
  userId: string,
  plan: AccountDeletionPlan,
): BatchItem<"pg">[] {
  const deleteSoloWorkspaces = plan.soloOwnedOrganizationIds.map((id) =>
    db.delete(organizations).where(eq(organizations.id, id)),
  );
  const reassign = REASSIGNED_TO_OWNER.map(({ table, column }) =>
    db
      .update(table as PgTable)
      .set({ [propertyNameOf(table, column)]: workspaceSuccessor(table, userId) } as never)
      .where(eq(column, userId)),
  );
  const deleteUser = db.delete(users).where(eq(users.id, userId));

  return [...deleteSoloWorkspaces, ...reassign, deleteUser];
}

/**
 * The member who inherits a row in its own workspace: the owner, or failing
 * that the longest-standing other member. Correlated on the outer row's
 * organization_id, qualified by hand because drizzle leaves column
 * references in an UPDATE unqualified, which inside this subquery would
 * resolve to om.organization_id instead.
 *
 * If nobody else is in that workspace this is NULL, the NOT NULL column
 * rejects it, and the whole batch rolls back: better a failed deletion than
 * rows silently lost.
 */
function workspaceSuccessor(table: Table, userId: string) {
  return sql`(
    select om.user_id from organization_members om
    where om.organization_id = ${sql.identifier(getTableName(table))}.organization_id
      and om.user_id <> ${userId}
    order by (om.role = 'owner') desc, om.created_at asc
    limit 1
  )`;
}

/** drizzle's .set() is keyed by the TypeScript property, not the SQL name. */
function propertyNameOf(table: Table, column: Column): string {
  const entry = Object.entries(getTableColumns(table)).find(([, c]) => c === column);
  if (!entry) throw new Error(`${column.name} is not a column of ${getTableName(table)}`);
  return entry[0];
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

/**
 * Whether this account has a password at all.
 *
 * Null for accounts created through Google sign-in, which have never set one
 * (see the credentials authorize callback in lib/auth.ts, which refuses them).
 * The settings panel needs the distinction to offer "set a password" rather
 * than "change password", and the change route needs it to know whether to
 * demand the current one.
 */
export async function hasPassword(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return Boolean(row?.passwordHash);
}

/** The stored hash, for verifying a current password. Null for OAuth-only. */
export async function getPasswordHash(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.passwordHash ?? null;
}

/** Replace the password hash. Hashing is the caller's job — this never sees a
 *  plaintext password, so no code path can accidentally log one from here. */
export async function setPasswordHash(userId: string, passwordHash: string) {
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

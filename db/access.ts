// Early-access waitlist gate: read/write users.access_status. See
// context/early-access-plan.md for the design.

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "./client";
import { organizationMembers, organizations, users } from "./schema";

export type AccessStatus = "pending" | "approved" | "rejected";

export async function getAccessStatus(userId: string): Promise<AccessStatus | null> {
  const [row] = await db
    .select({ accessStatus: users.accessStatus })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return (row?.accessStatus as AccessStatus) ?? null;
}

export type EarlyAccessInfo = {
  accessStatus: AccessStatus;
  name: string | null;
  email: string;
  waitlistAppliedEmailSentAt: Date | null;
};

/** Everything the /early-access page needs in one query. */
export async function getEarlyAccessInfo(userId: string): Promise<EarlyAccessInfo | null> {
  const [row] = await db
    .select({
      accessStatus: users.accessStatus,
      name: users.name,
      email: users.email,
      waitlistAppliedEmailSentAt: users.waitlistAppliedEmailSentAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return null;
  return { ...row, accessStatus: row.accessStatus as AccessStatus };
}

/**
 * Marks the applied-email as sent for this user. Guarded with a WHERE on
 * the column still being null, so two concurrent page loads racing to send
 * the email can't both win — only the first UPDATE affects a row, so the
 * caller can check the returned row to decide whether it actually sent it.
 */
export async function markWaitlistAppliedEmailSent(userId: string): Promise<boolean> {
  const [row] = await db
    .update(users)
    .set({ waitlistAppliedEmailSentAt: new Date() })
    .where(and(eq(users.id, userId), isNull(users.waitlistAppliedEmailSentAt)))
    .returning({ id: users.id });
  return Boolean(row);
}

export type AdminUserRow = {
  id: string;
  name: string | null;
  email: string;
  accessStatus: AccessStatus;
  organizationNames: string[];
  createdAt: Date;
  accessDecidedAt: Date | null;
  accessDecidedByUserId: string | null;
};

/** Every user, with their org name(s) — for the admin users list. */
export async function listUsersForAdmin(): Promise<AdminUserRow[]> {
  const [allUsers, memberships] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        accessStatus: users.accessStatus,
        createdAt: users.createdAt,
        accessDecidedAt: users.accessDecidedAt,
        accessDecidedByUserId: users.accessDecidedByUserId,
      })
      .from(users)
      .orderBy(desc(users.createdAt)),
    db
      .select({
        userId: organizationMembers.userId,
        organizationName: organizations.name,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id)),
  ]);

  const orgNamesByUser = new Map<string, string[]>();
  for (const row of memberships) {
    const list = orgNamesByUser.get(row.userId) ?? [];
    list.push(row.organizationName);
    orgNamesByUser.set(row.userId, list);
  }

  return allUsers.map((user) => ({
    ...user,
    accessStatus: user.accessStatus as AccessStatus,
    organizationNames: orgNamesByUser.get(user.id) ?? [],
  }));
}

export async function setAccessStatus(
  userId: string,
  accessStatus: AccessStatus,
  decidedByUserId: string,
) {
  const [row] = await db
    .update(users)
    .set({
      accessStatus,
      accessDecidedAt: new Date(),
      accessDecidedByUserId: decidedByUserId,
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      accessStatus: users.accessStatus,
    });
  return row ?? null;
}

/**
 * Approves a user as a side effect of accepting an org invite. Only an
 * already-approved org can send an invite, so a teammate accepting one is
 * joining a workspace that's already vetted — they shouldn't be stuck on
 * the waitlist behind the same gate as a stranger. No approved-email is
 * sent here; that email is reserved for admin-driven approvals.
 */
export async function approveViaInviteAccept(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ accessStatus: "approved", accessDecidedAt: new Date() })
    .where(eq(users.id, userId));
}

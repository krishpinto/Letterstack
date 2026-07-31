// Organization invites. tokenHash is the sha256 of the raw token mailed to
// the invitee — same pattern as db/password-resets.ts — so a leaked table
// row can't be replayed into a membership.

import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "./client";
import { organizationInvites, organizationMembers, organizations } from "./schema";
import { approveViaInviteAccept } from "./access";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type InviteRole = "member" | "admin";

function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

/** Mints an invite token for organizationId/email; returns the raw token for the email link. */
export async function createOrganizationInvite(
  organizationId: string,
  invitedByUserId: string,
  email: string,
  role: InviteRole = "member",
): Promise<string> {
  // Superseding any invite already pending for this org+email keeps a
  // re-invite's email pointing at the only link that still works.
  await db
    .update(organizationInvites)
    .set({ expiresAt: new Date() })
    .where(
      and(
        eq(organizationInvites.organizationId, organizationId),
        eq(organizationInvites.email, email),
        isNull(organizationInvites.acceptedAt),
      ),
    );

  const raw = randomBytes(32).toString("base64url");
  await db.insert(organizationInvites).values({
    organizationId,
    email,
    role,
    invitedByUserId,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });

  return raw;
}

export async function listPendingInvitesForOrganization(organizationId: string) {
  return db
    .select({
      id: organizationInvites.id,
      email: organizationInvites.email,
      role: organizationInvites.role,
      createdAt: organizationInvites.createdAt,
      expiresAt: organizationInvites.expiresAt,
    })
    .from(organizationInvites)
    .where(
      and(
        eq(organizationInvites.organizationId, organizationId),
        isNull(organizationInvites.acceptedAt),
      ),
    );
}

/** Read-only lookup for rendering the accept screen — does not consume the token. */
export async function getInviteByToken(raw: string) {
  const [row] = await db
    .select({
      id: organizationInvites.id,
      organizationId: organizationInvites.organizationId,
      organizationName: organizations.name,
      email: organizationInvites.email,
      role: organizationInvites.role,
      expiresAt: organizationInvites.expiresAt,
      acceptedAt: organizationInvites.acceptedAt,
      // Computed in SQL (not JS Date.now()) so the accept page — a Server
      // Component — never calls an impure function during render.
      expired: sql<boolean>`${organizationInvites.expiresAt} < now()`,
    })
    .from(organizationInvites)
    .innerJoin(organizations, eq(organizationInvites.organizationId, organizations.id))
    .where(eq(organizationInvites.tokenHash, hashToken(raw)))
    .limit(1);

  return row ?? null;
}

export type AcceptInviteResult =
  | { ok: true; organizationId: string }
  | { ok: false; error: "not_found" | "expired" | "email_mismatch" };

/**
 * Redeems a raw token for userId: adds the organization membership (if not
 * already present) and marks the invite accepted. Requires userEmail to
 * match the invited address — an invite is bound to the address it was sent
 * to, not to whichever account happens to click the link.
 */
export async function acceptOrganizationInvite(
  raw: string,
  userId: string,
  userEmail: string,
): Promise<AcceptInviteResult> {
  const [invite] = await db
    .select()
    .from(organizationInvites)
    .where(eq(organizationInvites.tokenHash, hashToken(raw)))
    .limit(1);

  if (!invite) return { ok: false, error: "not_found" };
  if (invite.acceptedAt) return { ok: false, error: "not_found" };
  if (invite.expiresAt.getTime() < Date.now()) return { ok: false, error: "expired" };
  if (invite.email.toLowerCase() !== userEmail.trim().toLowerCase()) {
    return { ok: false, error: "email_mismatch" };
  }

  await db
    .insert(organizationMembers)
    .values({ organizationId: invite.organizationId, userId, role: invite.role })
    .onConflictDoNothing({
      target: [organizationMembers.organizationId, organizationMembers.userId],
    });

  await db
    .update(organizationInvites)
    .set({ acceptedAt: new Date() })
    .where(eq(organizationInvites.id, invite.id));

  // Only an already-approved org can send an invite, so a teammate accepting
  // one is joining a vetted workspace — they shouldn't be stuck on the
  // early-access waitlist behind the same gate as a stranger.
  await approveViaInviteAccept(userId);

  return { ok: true, organizationId: invite.organizationId };
}

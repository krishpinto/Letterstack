import { and, eq, sql } from "drizzle-orm";
import { db } from "./client";
import { connectedMailboxes } from "./schema";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secret-box";

export type ConnectedMailbox = typeof connectedMailboxes.$inferSelect;

/** Every active-or-not mailbox this user has connected, across their orgs. */
export async function listMailboxesForUser(userId: string, organizationId: string) {
  return db
    .select()
    .from(connectedMailboxes)
    .where(
      and(
        eq(connectedMailboxes.userId, userId),
        eq(connectedMailboxes.organizationId, organizationId),
      ),
    )
    .orderBy(connectedMailboxes.createdAt);
}

export async function getMailbox(id: string) {
  const [row] = await db
    .select()
    .from(connectedMailboxes)
    .where(eq(connectedMailboxes.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * Connect or reconnect. Upserts on (organizationId, email) rather than
 * always inserting — reconnecting the same address after a dead token
 * (revoked, or the 7-day Testing-mode expiry) issues a fresh Google
 * refresh token for the same account, and this has to overwrite the
 * existing row and flip it back to active, not collide with the unique
 * constraint by trying to insert a second one.
 */
export async function upsertConnectedMailbox(input: {
  organizationId: string;
  userId: string;
  email: string;
  displayName: string | null;
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: Date;
  scope: string;
}) {
  const encrypted = encryptSecret(input.refreshToken);

  const [row] = await db
    .insert(connectedMailboxes)
    .values({
      organizationId: input.organizationId,
      userId: input.userId,
      email: input.email,
      displayName: input.displayName,
      refreshTokenCiphertext: encrypted.ciphertext,
      refreshTokenIv: encrypted.iv,
      refreshTokenTag: encrypted.tag,
      accessToken: input.accessToken,
      accessTokenExpiresAt: input.accessTokenExpiresAt,
      scope: input.scope,
      status: "active",
      lastError: null,
      quotaResetAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [connectedMailboxes.organizationId, connectedMailboxes.email],
      set: {
        userId: input.userId,
        displayName: input.displayName,
        refreshTokenCiphertext: encrypted.ciphertext,
        refreshTokenIv: encrypted.iv,
        refreshTokenTag: encrypted.tag,
        accessToken: input.accessToken,
        accessTokenExpiresAt: input.accessTokenExpiresAt,
        scope: input.scope,
        status: "active",
        lastError: null,
      },
    })
    .returning();

  return row;
}

export function decryptMailboxRefreshToken(mailbox: ConnectedMailbox): string {
  return decryptSecret({
    ciphertext: mailbox.refreshTokenCiphertext,
    iv: mailbox.refreshTokenIv,
    tag: mailbox.refreshTokenTag,
  });
}

/** Cache a freshly-refreshed access token so the next send skips the refresh round-trip. */
export async function updateMailboxAccessToken(
  id: string,
  accessToken: string,
  accessTokenExpiresAt: Date,
) {
  await db
    .update(connectedMailboxes)
    .set({ accessToken, accessTokenExpiresAt })
    .where(eq(connectedMailboxes.id, id));
}

/**
 * Mark a mailbox unusable — an expired/revoked refresh token, or anything
 * else that means it can't send until the person reconnects. Distinct from
 * a per-recipient send failure: this is "the whole mailbox is down."
 */
export async function markMailboxError(id: string, lastError: string) {
  await db
    .update(connectedMailboxes)
    .set({ status: "error", lastError })
    .where(eq(connectedMailboxes.id, id));
}

/** Revoke locally — used alongside actually revoking the token with Google (see lib/send/gmail-auth.ts). */
export async function markMailboxRevoked(id: string) {
  await db
    .update(connectedMailboxes)
    .set({ status: "revoked" })
    .where(eq(connectedMailboxes.id, id));
}

/**
 * Every not-already-revoked mailbox a user connected for one org — used
 * when they're removed from it, to revoke what's still live. Excludes
 * already-`revoked` rows so a member removal doesn't re-issue a Google
 * revoke call for a grant that's already dead.
 */
export async function listRevocableMailboxesForOrgMember(
  organizationId: string,
  userId: string,
) {
  return db
    .select()
    .from(connectedMailboxes)
    .where(
      and(
        eq(connectedMailboxes.organizationId, organizationId),
        eq(connectedMailboxes.userId, userId),
        sql`${connectedMailboxes.status} != 'revoked'`,
      ),
    );
}

export async function deleteMailbox(id: string, userId: string): Promise<boolean> {
  const rows = await db
    .delete(connectedMailboxes)
    .where(and(eq(connectedMailboxes.id, id), eq(connectedMailboxes.userId, userId)))
    .returning({ id: connectedMailboxes.id });
  return rows.length > 0;
}

// Reused fragment: the counter is windowed to the calendar day, and the
// window has to roll over inside the same statement that reserves — same
// reasoning as tryReserveSendQuota's monthly rollover in db/organizations.ts.
const DAY_ROLLED_OVER = sql`(${connectedMailboxes.quotaResetAt} < date_trunc('day', now()))`;
const SENT_TODAY = sql`(CASE WHEN ${DAY_ROLLED_OVER} THEN 0 ELSE ${connectedMailboxes.sentToday} END)`;

/**
 * Atomically reserve `count` sends against this mailbox's own daily cap —
 * separate from and in addition to the org's monthly plan quota
 * (tryReserveSendQuota in db/organizations.ts). Both have to be reserved
 * for a Gmail send: skipping this one would let a single connected mailbox
 * send far more per month than the plan it's on actually allows (see the
 * Gmail Sending plan's quota section for the numbers). A single guarded
 * UPDATE, same shape as tryReserveSendQuota, so concurrent sends from the
 * same mailbox can't both "pass" the check and jointly overshoot it.
 */
export async function tryReserveMailboxQuota(
  mailboxId: string,
  count: number,
): Promise<boolean> {
  if (count <= 0) return true;
  const [row] = await db
    .update(connectedMailboxes)
    .set({
      sentToday: sql`${SENT_TODAY} + ${count}`,
      quotaResetAt: sql`(CASE WHEN ${DAY_ROLLED_OVER} THEN date_trunc('day', now()) ELSE ${connectedMailboxes.quotaResetAt} END)`,
    })
    .where(
      and(
        eq(connectedMailboxes.id, mailboxId),
        eq(connectedMailboxes.status, "active"),
        sql`${SENT_TODAY} + ${count} <= ${connectedMailboxes.dailyLimit}`,
      ),
    )
    .returning({ sentToday: connectedMailboxes.sentToday });
  return Boolean(row);
}

/**
 * Undo a mailbox-quota reservation — used when that reservation succeeded
 * but the org's monthly plan quota (checked second, since it's the more
 * expensive-to-reverse one) then failed, so the campaign doesn't start at
 * all. Best-effort: if the day has rolled over since the reservation this
 * is a no-op, since there's nothing to release from a window that already
 * reset to zero.
 */
export async function releaseMailboxQuota(mailboxId: string, count: number): Promise<void> {
  if (count <= 0) return;
  await db
    .update(connectedMailboxes)
    .set({ sentToday: sql`greatest(0, ${connectedMailboxes.sentToday} - ${count})` })
    .where(and(eq(connectedMailboxes.id, mailboxId), sql`not (${DAY_ROLLED_OVER})`));
}

/** Today's usage against the mailbox's cap, for the quota meter and refusal messages. */
export async function getMailboxSendUsage(mailboxId: string) {
  const [row] = await db
    .select({
      used: sql<number>`${SENT_TODAY}::int`,
      limit: connectedMailboxes.dailyLimit,
    })
    .from(connectedMailboxes)
    .where(eq(connectedMailboxes.id, mailboxId))
    .limit(1);
  return { used: row?.used ?? 0, limit: row?.limit ?? 0 };
}

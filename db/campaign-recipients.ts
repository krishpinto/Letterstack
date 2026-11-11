import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import { campaignRecipients, campaigns } from "./schema";
import { listSuppressedSetForOrganization } from "./suppression";
import { UNKNOWN_DELIVERY_STATE, type RecipientCounts } from "@/lib/send/send-policy";

const INSERT_BATCH_SIZE = 1_000;

type AudiencePerson = {
  recipientId?: string | null;
  email: string;
  name?: string | null;
};

/**
 * The audience a send would go to right now: the campaign's pending rows,
 * split into those we may send to and those on the suppression list.
 *
 * Read-only on purpose. It runs before the campaign is claimed, and a
 * request that then loses the claim (or is refused for quota) must not have
 * changed anything; the caller fails the suppressed rows with
 * failPendingRecipients only after it has won.
 */
export async function readSendableAudience(campaignId: string, organizationId: string) {
  const [rows, blocked] = await Promise.all([
    db
      .select({ id: campaignRecipients.id, email: campaignRecipients.email })
      .from(campaignRecipients)
      .where(
        and(
          eq(campaignRecipients.campaignId, campaignId),
          eq(campaignRecipients.status, "pending"),
        ),
      ),
    listSuppressedSetForOrganization(organizationId),
  ]);

  return {
    allowed: rows.filter((row) => !blocked.has(row.email)),
    suppressed: rows.filter((row) => blocked.has(row.email)),
  };
}

/**
 * Every row of a campaign with its status, ordered by id. The batch planner
 * cuts batches over this list; see planBatches in lib/send/send-policy.ts.
 */
export async function listRecipientStates(campaignId: string) {
  return db
    .select({ id: campaignRecipients.id, status: campaignRecipients.status })
    .from(campaignRecipients)
    .where(eq(campaignRecipients.campaignId, campaignId))
    .orderBy(campaignRecipients.id);
}

export async function addCampaignRecipient(
  campaignId: string,
  person: AudiencePerson,
) {
  const [row] = await db
    .insert(campaignRecipients)
    .values({
      campaignId,
      recipientId: person.recipientId ?? null,
      email: person.email,
      name: person.name ?? null,
      status: "pending",
    })
    .onConflictDoNothing({
      target: [campaignRecipients.campaignId, campaignRecipients.email],
    })
    .returning();

  return row ?? null;
}

export async function addCampaignRecipientsBulk(
  campaignId: string,
  people: AudiencePerson[],
) {
  const inserted: (typeof campaignRecipients.$inferSelect)[] = [];

  for (let index = 0; index < people.length; index += INSERT_BATCH_SIZE) {
    const batch = people.slice(index, index + INSERT_BATCH_SIZE);
    if (batch.length === 0) continue;

    const rows = await db
      .insert(campaignRecipients)
      .values(
        batch.map((person) => ({
          campaignId,
          recipientId: person.recipientId ?? null,
          email: person.email,
          name: person.name ?? null,
          status: "pending" as const,
        })),
      )
      .onConflictDoNothing({
        target: [campaignRecipients.campaignId, campaignRecipients.email],
      })
      .returning();

    inserted.push(...rows);
  }

  return inserted;
}

/**
 * Fail recipients that no worker has claimed yet — addresses found on the
 * suppression list when the send starts. Guarded on "pending" so it can
 * never overwrite a row a worker is sending or has sent.
 */
export async function failPendingRecipients(ids: string[], error: string): Promise<void> {
  if (ids.length === 0) return;
  await db
    .update(campaignRecipients)
    .set({ status: "failed", sentAt: null, error })
    .where(and(inArray(campaignRecipients.id, ids), eq(campaignRecipients.status, "pending")));
}

/**
 * Fail every row of a campaign that no worker has claimed, when the
 * campaign itself has failed and nothing will ever send them. Returns how
 * many rows it failed, so the caller can release their quota.
 */
export async function failAllPendingForCampaign(campaignId: string, error: string): Promise<number> {
  const rows = await db
    .update(campaignRecipients)
    .set({ status: "failed", sentAt: null, error })
    .where(
      and(eq(campaignRecipients.campaignId, campaignId), eq(campaignRecipients.status, "pending")),
    )
    .returning({ id: campaignRecipients.id });
  return rows.length;
}

/**
 * Claim one recipient for sending: pending → sending, in one guarded UPDATE.
 * Returns the row only to the caller that made the move, so two workers
 * holding the same id (a QStash retry, a duplicate delivery, a Resume) can
 * never both send to it.
 *
 * Also refuses unless the campaign itself is "sending". A batch that outlived
 * its campaign — reverted to draft, or marked failed — sends nothing.
 *
 * The campaign check is hand-written SQL with fixed table names: drizzle
 * renders interpolated columns unqualified inside raw subqueries, which would
 * correlate against the wrong table (see listCampaignsForOrganization).
 */
export async function claimCampaignRecipient(
  id: string,
): Promise<{ id: string; email: string } | null> {
  const [row] = await db
    .update(campaignRecipients)
    .set({ status: "sending", claimedAt: sql`now()`, error: null })
    .where(
      and(
        eq(campaignRecipients.id, id),
        eq(campaignRecipients.status, "pending"),
        sql`exists (select 1 from campaigns c where c.id = campaign_recipients.campaign_id and c.status = 'sending')`,
      ),
    )
    .returning({ id: campaignRecipients.id, email: campaignRecipients.email });
  return row ?? null;
}

/**
 * Record what happened to a claimed recipient: sending → sent | failed.
 * Returns whether this call made the move. Guarded on "sending", so a late
 * or repeated write can never turn "sent" into "failed" or back.
 */
export async function finishCampaignRecipient(
  id: string,
  status: "sent" | "failed",
  error?: string,
): Promise<boolean> {
  const rows = await db
    .update(campaignRecipients)
    .set({
      status,
      sentAt: status === "sent" ? new Date() : null,
      error: error ?? null,
    })
    .where(and(eq(campaignRecipients.id, id), eq(campaignRecipients.status, "sending")))
    .returning({ id: campaignRecipients.id });
  return rows.length > 0;
}

/**
 * Put a claimed recipient back to "pending" — only for rows we know never
 * reached the provider (the provider refused with a retryable error, or the
 * worker failed before calling it), so the next attempt may send to them.
 */
export async function returnCampaignRecipientToPending(id: string): Promise<void> {
  await db
    .update(campaignRecipients)
    .set({ status: "pending", claimedAt: null })
    .where(and(eq(campaignRecipients.id, id), eq(campaignRecipients.status, "sending")));
}

/**
 * Settle rows whose claim is older than `timeoutMs`: the worker holding them
 * is gone, and we do not know whether the provider got the message.
 *
 * Rows SES has since reported on (any email_events row for this campaign
 * and address — Send, Delivery, Bounce, Open…) did reach SES, so they become
 * "sent". The event is our record of SES's message: the campaignId tag rides
 * on the message and SES echoes it back. Everything else becomes "failed"
 * with UNKNOWN_DELIVERY_STATE, never "pending" — see CLAIM_TIMEOUT_MS for
 * why this side of the trade-off. Gmail sends produce no events, so a
 * stale Gmail row always lands in the second group.
 *
 * Returns how many rows it settled each way. `timeoutMs` is our own
 * constant, rendered as a literal so Postgres can type the interval. The
 * event check is hand-written SQL for the same reason as
 * claimCampaignRecipient.
 */
export async function settleStaleClaims(
  campaignId: string,
  timeoutMs: number,
): Promise<{ sent: number; failed: number }> {
  const seconds = Math.max(1, Math.floor(timeoutMs / 1000));
  const stale = and(
    eq(campaignRecipients.campaignId, campaignId),
    eq(campaignRecipients.status, "sending"),
    sql`(${campaignRecipients.claimedAt} is null or ${campaignRecipients.claimedAt} < now() - interval '${sql.raw(String(seconds))} seconds')`,
  );

  const sent = await db
    .update(campaignRecipients)
    .set({ status: "sent", sentAt: sql`coalesce(claimed_at, now())`, error: null })
    .where(
      and(
        stale,
        sql`exists (select 1 from email_events e where e.campaign_id = campaign_recipients.campaign_id and lower(e.email) = lower(campaign_recipients.email))`,
      ),
    )
    .returning({ id: campaignRecipients.id });

  const failed = await db
    .update(campaignRecipients)
    .set({ status: "failed", sentAt: null, error: UNKNOWN_DELIVERY_STATE })
    .where(stale)
    .returning({ id: campaignRecipients.id });

  return { sent: sent.length, failed: failed.length };
}

/** How many of these recipients are claimed right now. */
export async function countSendingAmong(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(campaignRecipients)
    .where(and(inArray(campaignRecipients.id, ids), eq(campaignRecipients.status, "sending")));
  return row?.count ?? 0;
}

export async function userIdsForEmail(email: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ userId: campaigns.userId })
    .from(campaignRecipients)
    .innerJoin(campaigns, eq(campaignRecipients.campaignId, campaigns.id))
    .where(eq(campaignRecipients.email, email));

  return rows.map((row) => row.userId);
}

export async function organizationIdsForEmail(email: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ organizationId: campaigns.organizationId })
    .from(campaignRecipients)
    .innerJoin(campaigns, eq(campaignRecipients.campaignId, campaigns.id))
    .where(eq(campaignRecipients.email, email));

  return rows.map((row) => row.organizationId);
}

export async function suppressionTargetsForEmail(
  email: string,
): Promise<{ organizationId: string; userId: string }[]> {
  return db
    .selectDistinct({
      organizationId: campaigns.organizationId,
      userId: campaigns.userId,
    })
    .from(campaignRecipients)
    .innerJoin(campaigns, eq(campaignRecipients.campaignId, campaigns.id))
    .where(eq(campaignRecipients.email, email));
}

export async function listCampaignRecipients(campaignId: string) {
  return db
    .select({
      id: campaignRecipients.id,
      email: campaignRecipients.email,
      name: campaignRecipients.name,
      status: campaignRecipients.status,
      sentAt: campaignRecipients.sentAt,
      error: campaignRecipients.error,
    })
    .from(campaignRecipients)
    .where(eq(campaignRecipients.campaignId, campaignId))
    .orderBy(campaignRecipients.email);
}

export async function deleteCampaignRecipient(campaignId: string, id: string) {
  const rows = await db
    .delete(campaignRecipients)
    .where(
      and(
        eq(campaignRecipients.campaignId, campaignId),
        eq(campaignRecipients.id, id),
      ),
    )
    .returning({ id: campaignRecipients.id });

  return rows.length > 0;
}

export async function countRecipientsForCampaign(campaignId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(campaignRecipients)
    .where(eq(campaignRecipients.campaignId, campaignId));

  return row?.count ?? 0;
}

/** Recipient rows of one campaign by status. */
export async function recipientStatusCounts(campaignId: string): Promise<RecipientCounts> {
  const rows = await db
    .select({
      status: campaignRecipients.status,
      count: sql<number>`count(*)::int`,
    })
    .from(campaignRecipients)
    .where(eq(campaignRecipients.campaignId, campaignId))
    .groupBy(campaignRecipients.status);

  const byStatus = (status: string) =>
    rows.find((row) => row.status === status)?.count ?? 0;
  return {
    pending: byStatus("pending"),
    sending: byStatus("sending"),
    sent: byStatus("sent"),
    failed: byStatus("failed"),
  };
}

/**
 * Progress for the live monitor and the public API.
 *
 * `pending` keeps meaning "not finished yet" and so includes rows a worker
 * is sending right now; every existing reader treats pending > 0 as "still
 * going". `sending` is reported separately for readers that want it.
 */
export async function campaignProgress(campaignId: string) {
  const counts = await recipientStatusCounts(campaignId);
  const pending = counts.pending + counts.sending;
  return {
    total: counts.sent + counts.failed + pending,
    sent: counts.sent,
    failed: counts.failed,
    pending,
    sending: counts.sending,
  };
}

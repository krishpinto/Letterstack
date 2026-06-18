import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import { campaignRecipients, campaigns, recipients } from "./schema";
import { listSuppressedSet } from "./suppression";

/** Operations on the campaign↔recipient bridge — the per-campaign send status. */

/**
 * Freeze the audience: create one `pending` row per NON-suppressed recipient
 * OWNED BY `userId` (the campaign's owner). This locks in WHO this campaign goes
 * to — only the owner's contacts, minus the owner's do-not-mail list.
 */
export async function freezeAudience(campaignId: string, userId: string) {
  const people = await db
    .select()
    .from(recipients)
    .where(eq(recipients.userId, userId));
  // The owner's own do-not-mail list.
  const blocked = await listSuppressedSet(userId);
  const targets = people.filter((p) => !blocked.has(p.email));

  if (targets.length === 0) return [];

  return db
    .insert(campaignRecipients)
    .values(
      targets.map((p) => ({
        campaignId,
        recipientId: p.id,
        email: p.email,
        status: "pending" as const,
      })),
    )
    .returning();
}

/** Of a batch of campaign_recipient ids, which are STILL pending (retry-safe). */
export async function listPendingByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(campaignRecipients)
    .where(and(inArray(campaignRecipients.id, ids), eq(campaignRecipients.status, "pending")));
}

/** Record one person's outcome in this campaign. */
export async function markCampaignRecipient(
  id: string,
  status: "sent" | "failed",
  error?: string,
) {
  await db
    .update(campaignRecipients)
    .set({ status, sentAt: status === "sent" ? new Date() : null, error: error ?? null })
    .where(eq(campaignRecipients.id, id));
}

/**
 * Which users have mailed this address (via any campaign). The SES webhook uses
 * this to attribute a bounce/complaint: the address gets suppressed for every
 * account that actually sent to it, so a bad address removes itself from each.
 */
export async function userIdsForEmail(email: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ userId: campaigns.userId })
    .from(campaignRecipients)
    .innerJoin(campaigns, eq(campaignRecipients.campaignId, campaigns.id))
    .where(eq(campaignRecipients.email, email));
  return rows.map((r) => r.userId);
}

/** Every recipient row for one campaign (for the recipients table). Joins the
 * contact to surface their display name alongside the per-campaign outcome. */
export async function listCampaignRecipients(campaignId: string) {
  return db
    .select({
      id: campaignRecipients.id,
      email: campaignRecipients.email,
      name: recipients.name,
      status: campaignRecipients.status,
      sentAt: campaignRecipients.sentAt,
      error: campaignRecipients.error,
    })
    .from(campaignRecipients)
    .leftJoin(recipients, eq(campaignRecipients.recipientId, recipients.id))
    .where(eq(campaignRecipients.campaignId, campaignId))
    .orderBy(campaignRecipients.email);
}

/** How many recipients of this campaign are still pending (not yet sent/failed). */
export async function countPendingForCampaign(campaignId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(campaignRecipients)
    .where(
      and(
        eq(campaignRecipients.campaignId, campaignId),
        eq(campaignRecipients.status, "pending"),
      ),
    );
  return row?.count ?? 0;
}

/** Counts grouped by status — exactly what the live monitor polls. */
export async function campaignProgress(campaignId: string) {
  const rows = await db
    .select({ status: campaignRecipients.status, count: sql<number>`count(*)::int` })
    .from(campaignRecipients)
    .where(eq(campaignRecipients.campaignId, campaignId))
    .groupBy(campaignRecipients.status);

  const by = (s: string) => rows.find((r) => r.status === s)?.count ?? 0;
  const sent = by("sent");
  const failed = by("failed");
  const pending = by("pending");
  return { total: sent + failed + pending, sent, failed, pending };
}

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import { campaignRecipients, recipients, suppressedEmails } from "./schema";

/** Operations on the campaign↔recipient bridge — the per-campaign send status. */

/**
 * Freeze the audience: create one `pending` row per NON-suppressed recipient.
 * This locks in WHO this campaign goes to (the snapshot of the list at send time).
 */
export async function freezeAudience(campaignId: string) {
  const people = await db.select().from(recipients);
  const supp = await db.select({ email: suppressedEmails.email }).from(suppressedEmails);
  const blocked = new Set(supp.map((s) => s.email));
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

/** Every recipient row for one campaign (for the recipients table). */
export async function listCampaignRecipients(campaignId: string) {
  return db
    .select()
    .from(campaignRecipients)
    .where(eq(campaignRecipients.campaignId, campaignId))
    .orderBy(campaignRecipients.email);
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

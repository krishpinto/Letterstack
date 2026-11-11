import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import { automations, campaignRecipients, campaigns } from "./schema";
import { listSuppressedSetForOrganization } from "./suppression";
import { uniqueByOrganization, type SuppressionTarget } from "@/lib/webhooks/ses-event";

const INSERT_BATCH_SIZE = 1_000;

type AudiencePerson = {
  recipientId?: string | null;
  email: string;
  name?: string | null;
};

export async function prepareCampaignAudience(
  campaignId: string,
  organizationId: string,
) {
  const [rows, blocked] = await Promise.all([
    db
      .select()
      .from(campaignRecipients)
      .where(
        and(
          eq(campaignRecipients.campaignId, campaignId),
          eq(campaignRecipients.status, "pending"),
        ),
      ),
    listSuppressedSetForOrganization(organizationId),
  ]);

  const allowed = rows.filter((row) => !blocked.has(row.email));
  const suppressed = rows.filter((row) => blocked.has(row.email));

  await Promise.all(
    suppressed.map((row) =>
      markCampaignRecipient(row.id, "failed", "suppressed"),
    ),
  );

  return allowed;
}

/** @deprecated Existing callers should use prepareCampaignAudience. */
export async function freezeAudience(campaignId: string, organizationId: string) {
  return prepareCampaignAudience(campaignId, organizationId);
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

export async function listPendingByIds(ids: string[]) {
  if (ids.length === 0) return [];

  return db
    .select()
    .from(campaignRecipients)
    .where(
      and(
        inArray(campaignRecipients.id, ids),
        eq(campaignRecipients.status, "pending"),
      ),
    );
}

export async function markCampaignRecipient(
  id: string,
  status: "sent" | "failed",
  error?: string,
) {
  await db
    .update(campaignRecipients)
    .set({
      status,
      sentAt: status === "sent" ? new Date() : null,
      error: error ?? null,
    })
    .where(eq(campaignRecipients.id, id));
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

/**
 * Every workspace a bounce or complaint for this address should be recorded
 * in: each one whose campaigns have mailed it (an address that hard-bounces
 * for one sender is dead for all of them on the shared SES account), plus the
 * workspace behind the automation that sent this message, if it was one.
 *
 * Automation sends leave no campaign_recipients row, so without the
 * automation lookup a bounce from an automation-only contact was never
 * suppressed and the automation kept mailing it. The automation id comes from
 * the SES message tag, which only counts as trustworthy because the webhook
 * verifies the SNS signature first.
 */
export async function suppressionTargetsForEmail(
  email: string,
  options: { automationId?: string | null } = {},
): Promise<SuppressionTarget[]> {
  const [fromCampaigns, fromAutomation] = await Promise.all([
    db
      .selectDistinct({
        organizationId: campaigns.organizationId,
        userId: campaigns.userId,
      })
      .from(campaignRecipients)
      .innerJoin(campaigns, eq(campaignRecipients.campaignId, campaigns.id))
      .where(eq(campaignRecipients.email, email)),
    options.automationId
      ? db
          .select({
            organizationId: automations.organizationId,
            userId: automations.userId,
          })
          .from(automations)
          .where(eq(automations.id, options.automationId))
          .limit(1)
      : Promise.resolve([] as SuppressionTarget[]),
  ]);

  return uniqueByOrganization([...fromAutomation, ...fromCampaigns]);
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

export async function campaignProgress(campaignId: string) {
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
  const sent = byStatus("sent");
  const failed = byStatus("failed");
  const pending = byStatus("pending");

  return { total: sent + failed + pending, sent, failed, pending };
}
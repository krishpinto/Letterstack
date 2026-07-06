import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "./client";
import { getDefaultOrganizationForUser } from "./organizations";
import { campaigns, emailEvents, suppressedEmails } from "./schema";

export type CampaignEngagement = {
  delivered: number;
  bounced: number;
  complained: number;
  opensTotal: number;
  opensUnique: number;
  clicksTotal: number;
  clicksUnique: number;
};

const EMPTY_ENGAGEMENT: CampaignEngagement = {
  delivered: 0,
  bounced: 0,
  complained: 0,
  opensTotal: 0,
  opensUnique: 0,
  clicksTotal: 0,
  clicksUnique: 0,
};

export async function recordEvent(email: string, type: string, campaignId?: string | null) {
  await db.insert(emailEvents).values({ email, type, campaignId: campaignId ?? null });
}

export async function listEvents(limit = 20) {
  return db.select().from(emailEvents).orderBy(desc(emailEvents.createdAt)).limit(limit);
}

/**
 * Unsubscribes attributed to one campaign. The unsubscribe link identifies
 * the person, not the campaign, so this is an attribution heuristic: count
 * this campaign's recipients who unsubscribed after the send started. When
 * two campaigns go out close together the later one absorbs the credit —
 * fine for a monthly newsletter cadence.
 */
export async function campaignUnsubscribes(
  campaignId: string,
  organizationId: string,
  since: Date | null,
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(suppressedEmails)
    .where(
      and(
        eq(suppressedEmails.organizationId, organizationId),
        eq(suppressedEmails.reason, "unsubscribe"),
        // Hand-qualified for the same drizzle quirk as db/campaigns.ts.
        sql`suppressed_emails.email in (
          select cr.email from campaign_recipients cr
          where cr.campaign_id = ${campaignId}
        )`,
        ...(since ? [gte(suppressedEmails.createdAt, since)] : []),
      ),
    );

  return row?.count ?? 0;
}

export async function campaignEngagement(campaignId: string): Promise<CampaignEngagement> {
  const rows = await db
    .select({
      type: emailEvents.type,
      total: sql<number>`count(*)::int`,
      uniques: sql<number>`count(distinct ${emailEvents.email})::int`,
    })
    .from(emailEvents)
    .where(eq(emailEvents.campaignId, campaignId))
    .groupBy(emailEvents.type);

  return foldEngagement(rows);
}

export async function engagementByOrganization(
  organizationId: string,
): Promise<Map<string, CampaignEngagement>> {
  const rows = await db
    .select({
      campaignId: emailEvents.campaignId,
      type: emailEvents.type,
      total: sql<number>`count(*)::int`,
      uniques: sql<number>`count(distinct ${emailEvents.email})::int`,
    })
    .from(emailEvents)
    .innerJoin(campaigns, eq(emailEvents.campaignId, campaigns.id))
    .where(eq(campaigns.organizationId, organizationId))
    .groupBy(emailEvents.campaignId, emailEvents.type);

  const byCampaign = new Map<string, { type: string; total: number; uniques: number }[]>();
  for (const row of rows) {
    if (!row.campaignId) continue;
    const list = byCampaign.get(row.campaignId) ?? [];
    list.push({ type: row.type, total: row.total, uniques: row.uniques });
    byCampaign.set(row.campaignId, list);
  }

  const output = new Map<string, CampaignEngagement>();
  for (const [id, rowsForCampaign] of byCampaign) {
    output.set(id, foldEngagement(rowsForCampaign));
  }

  return output;
}

export async function engagementByCampaign(
  userId: string,
): Promise<Map<string, CampaignEngagement>> {
  const organization = await getDefaultOrganizationForUser(userId);
  if (!organization) return new Map();

  return engagementByOrganization(organization.id);
}

function foldEngagement(
  rows: { type: string; total: number; uniques: number }[],
): CampaignEngagement {
  const engagement: CampaignEngagement = { ...EMPTY_ENGAGEMENT };

  for (const row of rows) {
    switch (row.type) {
      case "Delivery":
        engagement.delivered = row.total;
        break;
      case "Bounce":
        engagement.bounced = row.total;
        break;
      case "Complaint":
        engagement.complained = row.total;
        break;
      case "Open":
        engagement.opensTotal = row.total;
        engagement.opensUnique = row.uniques;
        break;
      case "Click":
        engagement.clicksTotal = row.total;
        engagement.clicksUnique = row.uniques;
        break;
    }
  }

  return engagement;
}

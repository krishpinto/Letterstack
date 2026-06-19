import { desc, eq, sql } from "drizzle-orm";
import { db } from "./client";
import { campaigns, emailEvents } from "./schema";

/** Record one SES event (Delivery / Bounce / Complaint / Open / Click / …),
 * optionally attributed to the campaign whose send produced it. */
export async function recordEvent(email: string, type: string, campaignId?: string | null) {
  await db.insert(emailEvents).values({ email, type, campaignId: campaignId ?? null });
}

/** Read the most recent events — for the lab card. */
export async function listEvents(limit = 20) {
  return db.select().from(emailEvents).orderBy(desc(emailEvents.createdAt)).limit(limit);
}

/** Engagement = SES event types this address generated. Opens/clicks are
 * counted both raw (total events) and unique (distinct address). */
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

/** Aggregate one campaign's events into engagement counts. */
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

/** Same aggregation for EVERY campaign owned by a user, in one query — for the
 * analytics overview table. Returns a map of campaignId → engagement. */
export async function engagementByCampaign(
  userId: string,
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
    .where(eq(campaigns.userId, userId))
    .groupBy(emailEvents.campaignId, emailEvents.type);

  const byCampaign = new Map<string, { type: string; total: number; uniques: number }[]>();
  for (const r of rows) {
    if (!r.campaignId) continue;
    const list = byCampaign.get(r.campaignId) ?? [];
    list.push({ type: r.type, total: r.total, uniques: r.uniques });
    byCampaign.set(r.campaignId, list);
  }

  const out = new Map<string, CampaignEngagement>();
  for (const [id, list] of byCampaign) out.set(id, foldEngagement(list));
  return out;
}

/** Collapse grouped (type, total, uniques) rows into one engagement record.
 * SES event types: Delivery / Bounce / Complaint / Open / Click. */
function foldEngagement(
  rows: { type: string; total: number; uniques: number }[],
): CampaignEngagement {
  const e: CampaignEngagement = { ...EMPTY_ENGAGEMENT };
  for (const r of rows) {
    switch (r.type) {
      case "Delivery":
        e.delivered = r.total;
        break;
      case "Bounce":
        e.bounced = r.total;
        break;
      case "Complaint":
        e.complained = r.total;
        break;
      case "Open":
        e.opensTotal = r.total;
        e.opensUnique = r.uniques;
        break;
      case "Click":
        e.clicksTotal = r.total;
        e.clicksUnique = r.uniques;
        break;
    }
  }
  return e;
}

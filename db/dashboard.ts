// Aggregates for the workspace dashboard: headline stats with
// week-over-week movement, and a daily delivered/opened series for the
// chart. Event rows are org-scoped through their campaign; automation sends
// (no campaignId) are excluded here.

import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "./client";
import { campaigns, emailEvents, recipients } from "./schema";

const DAY_MS = 86_400_000;

export type DashboardStats = {
  audience: number;
  audienceNew7: number;
  audiencePrev7: number;
  campaignsSent: number;
  campaignsSent7: number;
  campaignsSentPrev7: number;
  delivered: number;
  delivered7: number;
  deliveredPrev7: number;
  opensUnique: number;
  openRate: number;
};

export type DashboardSeriesPoint = {
  date: string; // YYYY-MM-DD
  delivered: number;
  opened: number;
};

export async function dashboardStats(organizationId: string): Promise<DashboardStats> {
  const now = Date.now();
  const week = new Date(now - 7 * DAY_MS);
  const twoWeeks = new Date(now - 14 * DAY_MS);

  const [audienceRow] = await db
    .select({
      total: sql<number>`count(*)::int`,
      new7: sql<number>`count(*) filter (where ${recipients.createdAt} >= ${week})::int`,
      prev7: sql<number>`count(*) filter (where ${recipients.createdAt} >= ${twoWeeks} and ${recipients.createdAt} < ${week})::int`,
    })
    .from(recipients)
    .where(eq(recipients.organizationId, organizationId));

  const [campaignRow] = await db
    .select({
      total: sql<number>`count(*) filter (where ${campaigns.status} in ('sent', 'sending'))::int`,
      new7: sql<number>`count(*) filter (where ${campaigns.status} in ('sent', 'sending') and ${campaigns.sentAt} >= ${week})::int`,
      prev7: sql<number>`count(*) filter (where ${campaigns.status} in ('sent', 'sending') and ${campaigns.sentAt} >= ${twoWeeks} and ${campaigns.sentAt} < ${week})::int`,
    })
    .from(campaigns)
    .where(eq(campaigns.organizationId, organizationId));

  const [eventRow] = await db
    .select({
      delivered: sql<number>`count(*) filter (where email_events.type = 'Delivery')::int`,
      delivered7: sql<number>`count(*) filter (where email_events.type = 'Delivery' and email_events.created_at >= ${week})::int`,
      deliveredPrev7: sql<number>`count(*) filter (where email_events.type = 'Delivery' and email_events.created_at >= ${twoWeeks} and email_events.created_at < ${week})::int`,
      opensUnique: sql<number>`count(distinct (email_events.campaign_id, email_events.email)) filter (where email_events.type = 'Open')::int`,
    })
    .from(emailEvents)
    .innerJoin(campaigns, eq(emailEvents.campaignId, campaigns.id))
    .where(eq(campaigns.organizationId, organizationId));

  const delivered = eventRow?.delivered ?? 0;
  const opensUnique = eventRow?.opensUnique ?? 0;

  return {
    audience: audienceRow?.total ?? 0,
    audienceNew7: audienceRow?.new7 ?? 0,
    audiencePrev7: audienceRow?.prev7 ?? 0,
    campaignsSent: campaignRow?.total ?? 0,
    campaignsSent7: campaignRow?.new7 ?? 0,
    campaignsSentPrev7: campaignRow?.prev7 ?? 0,
    delivered,
    delivered7: eventRow?.delivered7 ?? 0,
    deliveredPrev7: eventRow?.deliveredPrev7 ?? 0,
    opensUnique,
    openRate: delivered > 0 ? Math.round((opensUnique / delivered) * 100) : 0,
  };
}

export async function dashboardSeries(
  organizationId: string,
  days = 14,
): Promise<DashboardSeriesPoint[]> {
  const since = new Date(Date.now() - (days - 1) * DAY_MS);
  since.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', email_events.created_at), 'YYYY-MM-DD')`,
      type: emailEvents.type,
      count: sql<number>`count(*)::int`,
    })
    .from(emailEvents)
    .innerJoin(campaigns, eq(emailEvents.campaignId, campaigns.id))
    .where(
      and(
        eq(campaigns.organizationId, organizationId),
        gte(emailEvents.createdAt, since),
        lt(emailEvents.createdAt, new Date(Date.now() + DAY_MS)),
      ),
    )
    .groupBy(sql`1`, emailEvents.type);

  const byDay = new Map<string, DashboardSeriesPoint>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since.getTime() + i * DAY_MS);
    const key = d.toISOString().slice(0, 10);
    byDay.set(key, { date: key, delivered: 0, opened: 0 });
  }
  for (const row of rows) {
    const point = byDay.get(row.day);
    if (!point) continue;
    if (row.type === "Delivery") point.delivered = row.count;
    if (row.type === "Open") point.opened = row.count;
  }

  return Array.from(byDay.values());
}

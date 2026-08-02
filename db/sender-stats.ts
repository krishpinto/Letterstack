// Per-user sending activity for the admin panel — lets a founder tell CIBA's
// sends apart from any other user's at a glance, rather than only seeing
// platform-wide totals.

import { eq, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import { campaignRecipients, campaigns, organizationMembers, organizations, users } from "./schema";

export type SenderStatsRow = {
  userId: string;
  name: string | null;
  email: string;
  organizationNames: string[];
  campaignsTotal: number;
  campaignsSent: number;
  emailsSent: number;
  lastSentAt: Date | null;
};

/** One row per user who has created at least one campaign, sorted by emails sent. */
export async function listSenderStats(): Promise<SenderStatsRow[]> {
  const campaignRows = await db
    .select({
      userId: campaigns.userId,
      campaignsTotal: sql<number>`count(distinct ${campaigns.id})`,
      campaignsSent: sql<number>`count(distinct ${campaigns.id}) filter (where ${campaigns.status} = 'sent')`,
      emailsSent: sql<number>`count(${campaignRecipients.id}) filter (where ${campaignRecipients.status} = 'sent')`,
      lastSentAt: sql<Date | null>`max(${campaignRecipients.sentAt})`,
    })
    .from(campaigns)
    .leftJoin(campaignRecipients, eq(campaignRecipients.campaignId, campaigns.id))
    .groupBy(campaigns.userId);

  if (campaignRows.length === 0) return [];

  const userIds = campaignRows.map((row) => row.userId);
  const [userRows, memberships] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(inArray(users.id, userIds)),
    db
      .select({
        userId: organizationMembers.userId,
        organizationName: organizations.name,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(inArray(organizationMembers.userId, userIds)),
  ]);

  const userById = new Map(userRows.map((row) => [row.id, row]));
  const orgNamesByUser = new Map<string, string[]>();
  for (const row of memberships) {
    const list = orgNamesByUser.get(row.userId) ?? [];
    list.push(row.organizationName);
    orgNamesByUser.set(row.userId, list);
  }

  return campaignRows
    .map((row) => {
      const user = userById.get(row.userId);
      return {
        userId: row.userId,
        name: user?.name ?? null,
        email: user?.email ?? "(deleted user)",
        organizationNames: orgNamesByUser.get(row.userId) ?? [],
        campaignsTotal: Number(row.campaignsTotal),
        campaignsSent: Number(row.campaignsSent),
        emailsSent: Number(row.emailsSent),
        lastSentAt: row.lastSentAt ? new Date(row.lastSentAt) : null,
      };
    })
    .sort((a, b) => b.emailsSent - a.emailsSent);
}

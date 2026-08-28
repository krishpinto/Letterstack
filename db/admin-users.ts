// Everything the admin Users tab reads: who signed up, what they have sent,
// and which workspaces — and therefore which plans — they hold.
//
// Two shapes, because the tab has two views. `listAdminUsers` fills the table
// (one row per person, every account, not only the ones who have sent);
// `getAdminUserDetail` fills the screen that opens when a row is clicked and
// adds the campaign-by-campaign history.
//
// Plans live on organizations, not on users, so a person's "plan" here is
// always derived from the workspaces they belong to. That is also why every
// plan control in the UI acts on an organization id.

import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import { planState, type PlanState } from "./organizations";
import {
  campaignRecipients,
  campaigns,
  organizationMembers,
  organizations,
  users,
} from "./schema";
import { higherPlan, limitsFor, type PlanKey } from "@/lib/plans/limits";

// The same month-window rule the send path reserves against (see
// tryReserveSendQuota), evaluated in SQL rather than re-derived in JS, so the
// number an admin reads is the number a send would be checked against — a
// stale period start reads as zero used, not as last month's total.
const EMAILS_THIS_MONTH = sql<number>`(CASE WHEN ${organizations.emailsSentPeriodStart} IS NULL OR ${organizations.emailsSentPeriodStart} < date_trunc('month', now()) THEN 0 ELSE ${organizations.emailsSentCount} END)`;

export type AdminOrgSummary = {
  id: string;
  name: string;
  type: string;
  /** This user's role in the workspace — owner or member. */
  role: string;
  plan: PlanKey;
  planSource: PlanState["source"];
  planExpiresAt: Date | null;
  daysLeft: number | null;
  memberCount: number;
  contacts: number;
  suppressed: number;
  campaigns: number;
  emailsThisMonth: number;
  /** What the plan in force allows, so the panel can show used-of-allowed. */
  emailAllowance: number;
  contactAllowance: number;
  createdAt: Date;
};

export type AdminUserRow = {
  userId: string;
  name: string | null;
  email: string;
  /** Google-only accounts have no password hash — worth knowing before telling someone to reset one. */
  authMethod: "password" | "google";
  createdAt: Date;
  organizations: AdminOrgSummary[];
  /** The best plan any of their workspaces is on — what the table's badge shows. */
  topPlan: PlanKey;
  campaignsTotal: number;
  campaignsSent: number;
  emailsSent: number;
  lastSentAt: Date | null;
  /** Contacts across every workspace they belong to. */
  contacts: number;
};

export type AdminCampaignRow = {
  id: string;
  name: string;
  subject: string;
  status: string;
  organizationName: string;
  createdAt: Date;
  scheduledAt: Date | null;
  sentAt: Date | null;
  recipients: number;
  sent: number;
  failed: number;
};

export type AdminUserDetail = AdminUserRow & {
  campaignHistory: AdminCampaignRow[];
};

type SendTotals = {
  campaignsTotal: number;
  campaignsSent: number;
  emailsSent: number;
  lastSentAt: Date | null;
};

/**
 * Workspace rows for a set of users, with the counts the panel shows.
 *
 * The counts are correlated subqueries rather than joins: a user can be in
 * several workspaces and a workspace holds several of each thing, so joining
 * them all at once multiplies the rows and every total comes out wrong. Same
 * reason `listOrganizationsForAdmin` counts members this way.
 */
async function organizationsByUser(userIds: string[]) {
  const rows = await db
    .select({
      userId: organizationMembers.userId,
      role: organizationMembers.role,
      id: organizations.id,
      name: organizations.name,
      type: organizations.type,
      plan: organizations.plan,
      planSource: organizations.planSource,
      planExpiresAt: organizations.planExpiresAt,
      createdAt: organizations.createdAt,
      emailsThisMonth: EMAILS_THIS_MONTH,
      // Hand-qualified, like organizationSelect() in db/organizations.ts: an
      // interpolated column renders unqualified here, which inside these
      // subqueries would resolve against the aliased table instead of against
      // organizations — and quietly count nothing rather than erroring.
      memberCount: sql<number>`(select count(*)::int from organization_members om where om.organization_id = organizations.id)`,
      contacts: sql<number>`(select count(*)::int from recipients r where r.organization_id = organizations.id)`,
      suppressed: sql<number>`(select count(*)::int from suppressed_emails s where s.organization_id = organizations.id)`,
      campaigns: sql<number>`(select count(*)::int from campaigns c where c.organization_id = organizations.id)`,
    })
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizationMembers.organizationId, organizations.id),
    )
    .where(inArray(organizationMembers.userId, userIds))
    .orderBy(asc(organizations.createdAt));

  const byUser = new Map<string, AdminOrgSummary[]>();
  for (const row of rows) {
    const state = planState(row);
    const limits = limitsFor(state.plan);
    const list = byUser.get(row.userId) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      type: row.type,
      role: row.role,
      plan: state.plan,
      planSource: state.source,
      planExpiresAt: state.expiresAt,
      daysLeft: state.daysLeft,
      memberCount: Number(row.memberCount),
      contacts: Number(row.contacts),
      suppressed: Number(row.suppressed),
      campaigns: Number(row.campaigns),
      emailsThisMonth: Number(row.emailsThisMonth),
      emailAllowance: limits.emailsPerMonth,
      contactAllowance: limits.contacts,
      createdAt: row.createdAt,
    });
    byUser.set(row.userId, list);
  }
  return byUser;
}

/** Campaign and send totals for the users passed in. */
async function sendTotalsByUser(userIds: string[]) {
  const rows = await db
    .select({
      userId: campaigns.userId,
      campaignsTotal: sql<number>`count(distinct ${campaigns.id})`,
      campaignsSent: sql<number>`count(distinct ${campaigns.id}) filter (where ${campaigns.status} = 'sent')`,
      emailsSent: sql<number>`count(${campaignRecipients.id}) filter (where ${campaignRecipients.status} = 'sent')`,
      lastSentAt: sql<Date | null>`max(${campaignRecipients.sentAt})`,
    })
    .from(campaigns)
    .leftJoin(campaignRecipients, eq(campaignRecipients.campaignId, campaigns.id))
    .where(inArray(campaigns.userId, userIds))
    .groupBy(campaigns.userId);

  const byUser = new Map<string, SendTotals>();
  for (const row of rows) {
    byUser.set(row.userId, {
      campaignsTotal: Number(row.campaignsTotal),
      campaignsSent: Number(row.campaignsSent),
      emailsSent: Number(row.emailsSent),
      lastSentAt: row.lastSentAt ? new Date(row.lastSentAt) : null,
    });
  }
  return byUser;
}

function toUserRow(
  user: {
    id: string;
    name: string | null;
    email: string;
    passwordHash: string | null;
    createdAt: Date;
  },
  orgs: AdminOrgSummary[],
  totals: SendTotals | undefined,
): AdminUserRow {
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    authMethod: user.passwordHash ? "password" : "google",
    createdAt: user.createdAt,
    organizations: orgs,
    topPlan: orgs.reduce<PlanKey>((best, org) => higherPlan(best, org.plan), "free"),
    campaignsTotal: totals?.campaignsTotal ?? 0,
    campaignsSent: totals?.campaignsSent ?? 0,
    emailsSent: totals?.emailsSent ?? 0,
    lastSentAt: totals?.lastSentAt ?? null,
    contacts: orgs.reduce((sum, org) => sum + org.contacts, 0),
  };
}

/**
 * Every account, newest first — including the ones that have never sent, which
 * is exactly the set a founder wants to look at during a beta.
 */
export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const userRows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      passwordHash: users.passwordHash,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  if (userRows.length === 0) return [];

  const userIds = userRows.map((row) => row.id);
  const [orgsByUser, totalsByUser] = await Promise.all([
    organizationsByUser(userIds),
    sendTotalsByUser(userIds),
  ]);

  return userRows.map((user) =>
    toUserRow(user, orgsByUser.get(user.id) ?? [], totalsByUser.get(user.id)),
  );
}

/** One user, plus the campaign-by-campaign history the detail screen shows. */
export async function getAdminUserDetail(
  userId: string,
): Promise<AdminUserDetail | null> {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      passwordHash: users.passwordHash,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return null;

  const [orgsByUser, totalsByUser, campaignRows] = await Promise.all([
    organizationsByUser([userId]),
    sendTotalsByUser([userId]),
    db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        subject: campaigns.subject,
        status: campaigns.status,
        organizationName: organizations.name,
        createdAt: campaigns.createdAt,
        scheduledAt: campaigns.scheduledAt,
        sentAt: campaigns.sentAt,
        recipients: sql<number>`count(${campaignRecipients.id})`,
        sent: sql<number>`count(${campaignRecipients.id}) filter (where ${campaignRecipients.status} = 'sent')`,
        failed: sql<number>`count(${campaignRecipients.id}) filter (where ${campaignRecipients.status} = 'failed')`,
      })
      .from(campaigns)
      .innerJoin(organizations, eq(campaigns.organizationId, organizations.id))
      .leftJoin(campaignRecipients, eq(campaignRecipients.campaignId, campaigns.id))
      .where(eq(campaigns.userId, userId))
      .groupBy(campaigns.id, organizations.name)
      // Drafts sort by when they were written, sends by when they went out, so
      // the newest thing that actually happened is always on top.
      .orderBy(desc(sql`coalesce(${campaigns.sentAt}, ${campaigns.createdAt})`))
      .limit(100),
  ]);

  return {
    ...toUserRow(user, orgsByUser.get(userId) ?? [], totalsByUser.get(userId)),
    campaignHistory: campaignRows.map((row) => ({
      id: row.id,
      name: row.name,
      subject: row.subject,
      status: row.status,
      organizationName: row.organizationName,
      createdAt: row.createdAt,
      scheduledAt: row.scheduledAt,
      sentAt: row.sentAt,
      recipients: Number(row.recipients),
      sent: Number(row.sent),
      failed: Number(row.failed),
    })),
  };
}

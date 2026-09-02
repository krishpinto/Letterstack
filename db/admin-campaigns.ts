// Everything the admin Campaigns tab reads: every campaign on the platform,
// and the exact HTML any one of them sent.
//
// The content comes from html_snapshot — the copy frozen at send time
// (architecture non-negotiable #6) — so this reports what actually went out
// rather than re-compiling a document that may have been edited since. It is
// also why nothing needs to be copied to an inbox to be reviewable: the sent
// email is already in this table.
//
// Two shapes, like db/admin-users.ts. `listAdminCampaigns` fills the table and
// deliberately leaves the snapshots out — they are entire emails, and a
// hundred of them in one JSON response is megabytes for a view that only
// shows subject lines. `getAdminCampaign` loads the snapshot for the one
// campaign being previewed.

import { desc, eq, sql } from "drizzle-orm";
import { db } from "./client";
import { campaignRecipients, campaigns, organizations, users } from "./schema";

export type AdminCampaignListRow = {
  id: string;
  name: string;
  subject: string;
  status: string;
  organizationId: string;
  organizationName: string;
  /** The account that owns the campaign — who to talk to about it. */
  senderName: string | null;
  senderEmail: string;
  /** The From the recipients actually saw, which is not the account email. */
  fromName: string;
  fromEmail: string;
  /** shared | domain | mailbox — which channel carried it. */
  senderType: string;
  createdAt: Date;
  scheduledAt: Date | null;
  sentAt: Date | null;
  recipients: number;
  sent: number;
  failed: number;
};

export type AdminCampaignDetail = AdminCampaignListRow & {
  htmlSnapshot: string;
  textSnapshot: string;
  replyTo: string | null;
};

// Grouping by the three primary keys rather than by each displayed column:
// Postgres treats every other column of those tables as functionally
// dependent on its own PK, so all of campaigns.*, organizations.* and users.*
// stay selectable — including html_snapshot, which would otherwise mean
// grouping by a whole email body.
const GROUP_KEYS = [campaigns.id, organizations.id, users.id] as const;

const COUNTS = {
  recipients: sql<number>`count(${campaignRecipients.id})`,
  sent: sql<number>`count(${campaignRecipients.id}) filter (where ${campaignRecipients.status} = 'sent')`,
  failed: sql<number>`count(${campaignRecipients.id}) filter (where ${campaignRecipients.status} = 'failed')`,
};

const LIST_COLUMNS = {
  id: campaigns.id,
  name: campaigns.name,
  subject: campaigns.subject,
  status: campaigns.status,
  organizationId: campaigns.organizationId,
  organizationName: organizations.name,
  senderName: users.name,
  senderEmail: users.email,
  fromName: campaigns.fromName,
  fromEmail: campaigns.fromEmail,
  senderType: campaigns.senderType,
  createdAt: campaigns.createdAt,
  scheduledAt: campaigns.scheduledAt,
  sentAt: campaigns.sentAt,
  ...COUNTS,
};

// The three aggregates arrive as strings from node-postgres (count() is
// bigint), so every row goes through here before it reaches the UI — a
// template literal on a string count silently renders "0012" instead of
// adding up.
function withCounts<T extends { recipients: number; sent: number; failed: number }>(
  row: T,
): T {
  return {
    ...row,
    recipients: Number(row.recipients),
    sent: Number(row.sent),
    failed: Number(row.failed),
  };
}

/**
 * Every campaign on the platform, most recent activity first.
 *
 * Capped at 200: this is a beta-scale founder view, and the tab filters
 * client-side over whatever it gets. Raise the cap when the list outgrows it
 * — that will be a good problem.
 */
export async function listAdminCampaigns(): Promise<AdminCampaignListRow[]> {
  const rows = await db
    .select(LIST_COLUMNS)
    .from(campaigns)
    .innerJoin(organizations, eq(campaigns.organizationId, organizations.id))
    .innerJoin(users, eq(campaigns.userId, users.id))
    .leftJoin(campaignRecipients, eq(campaignRecipients.campaignId, campaigns.id))
    .groupBy(...GROUP_KEYS)
    // Drafts sort by when they were written, sends by when they went out — so
    // the newest thing that actually happened is on top either way. Same rule
    // as the per-user history in db/admin-users.ts.
    .orderBy(desc(sql`coalesce(${campaigns.sentAt}, ${campaigns.createdAt})`))
    .limit(200);

  return rows.map(withCounts);
}

/** One campaign, with the frozen HTML the preview renders. */
export async function getAdminCampaign(
  campaignId: string,
): Promise<AdminCampaignDetail | null> {
  const [row] = await db
    .select({
      ...LIST_COLUMNS,
      htmlSnapshot: campaigns.htmlSnapshot,
      textSnapshot: campaigns.textSnapshot,
      replyTo: campaigns.replyTo,
    })
    .from(campaigns)
    .innerJoin(organizations, eq(campaigns.organizationId, organizations.id))
    .innerJoin(users, eq(campaigns.userId, users.id))
    .leftJoin(campaignRecipients, eq(campaignRecipients.campaignId, campaigns.id))
    .where(eq(campaigns.id, campaignId))
    .groupBy(...GROUP_KEYS)
    .limit(1);

  if (!row) return null;

  return withCounts(row);
}

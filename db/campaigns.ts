import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./client";
import { campaigns, campaignRecipients } from "./schema";
import type { EmailDocument } from "@/lib/email/document";

/**
 * Create a draft campaign owned by `userId`. `document` is the editable design
 * (kept while the campaign is a draft); html/text are the compiled snapshot,
 * recompiled from the document on every edit and frozen at send time.
 */
export async function createCampaign(
  userId: string,
  input: {
    name: string;
    subject: string;
    fromName: string;
    fromEmail: string;
    html: string;
    text: string;
    document?: EmailDocument;
  },
) {
  const [row] = await db
    .insert(campaigns)
    .values({
      userId,
      name: input.name,
      subject: input.subject,
      fromName: input.fromName,
      fromEmail: input.fromEmail,
      document: input.document,
      htmlSnapshot: input.html, // frozen — what actually gets sent
      textSnapshot: input.text,
      status: "draft",
    })
    .returning();
  return row;
}

/**
 * Update a draft campaign's design + recompiled snapshot. Scoped to the owner
 * AND to status "draft" so a sent campaign's record can never be rewritten.
 * Returns the updated row, or null if it wasn't an editable draft of this user.
 */
export async function updateCampaignDraft(
  id: string,
  userId: string,
  input: {
    name?: string;
    subject?: string;
    fromName?: string;
    fromEmail?: string;
    html: string;
    text: string;
    document: EmailDocument;
  },
) {
  const [row] = await db
    .update(campaigns)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.subject !== undefined ? { subject: input.subject } : {}),
      ...(input.fromName !== undefined ? { fromName: input.fromName } : {}),
      ...(input.fromEmail ? { fromEmail: input.fromEmail } : {}),
      document: input.document,
      htmlSnapshot: input.html,
      textSnapshot: input.text,
    })
    .where(and(eq(campaigns.id, id), eq(campaigns.userId, userId), eq(campaigns.status, "draft")))
    .returning();
  return row ?? null;
}

/**
 * This user's campaigns, newest first — each with its frozen audience size and
 * how many actually sent. The two counts come from campaign_recipients (rows
 * only exist once a send starts), so drafts report 0/0.
 */
export async function listCampaigns(userId: string) {
  return db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      subject: campaigns.subject,
      fromName: campaigns.fromName,
      fromEmail: campaigns.fromEmail,
      status: campaigns.status,
      createdAt: campaigns.createdAt,
      sentAt: campaigns.sentAt,
      audienceCount: sql<number>`(
        select count(*)::int from ${campaignRecipients}
        where ${campaignRecipients.campaignId} = ${campaigns.id}
      )`,
      sentCount: sql<number>`(
        select count(*)::int from ${campaignRecipients}
        where ${campaignRecipients.campaignId} = ${campaigns.id}
          and ${campaignRecipients.status} = 'sent'
      )`,
    })
    .from(campaigns)
    .where(eq(campaigns.userId, userId))
    .orderBy(desc(campaigns.createdAt));
}

/**
 * One campaign by id (or null). Unscoped — used by background workers that have
 * no session. API routes that serve a user must check `campaign.userId` against
 * the caller (or use `getCampaignForUser`).
 */
export async function getCampaign(id: string) {
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return row ?? null;
}

/** One campaign by id, but only if it belongs to this user (else null). */
export async function getCampaignForUser(id: string, userId: string) {
  const [row] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.userId, userId)))
    .limit(1);
  return row ?? null;
}

/** Flip a campaign to "sending" and stamp when the send started. */
export async function markCampaignSending(id: string) {
  await db
    .update(campaigns)
    .set({ status: "sending", sentAt: new Date() })
    .where(eq(campaigns.id, id));
}

/**
 * Flip a campaign to "sent" — called by the last batch worker to finish, once no
 * recipients remain pending. Scoped to a campaign still "sending" so a late retry
 * can't resurrect a finished campaign.
 */
export async function markCampaignSent(id: string) {
  await db
    .update(campaigns)
    .set({ status: "sent" })
    .where(and(eq(campaigns.id, id), eq(campaigns.status, "sending")));
}

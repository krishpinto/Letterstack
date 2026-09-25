import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "./client";
import { campaignRecipients, campaigns, organizationMembers } from "./schema";
import { getDefaultOrganizationForUser } from "./organizations";
import type { EmailDocument } from "@/lib/email/document";

export async function createCampaign(
  userId: string,
  organizationId: string,
  input: {
    name: string;
    subject: string;
    fromName: string;
    fromEmail: string;
    html: string;
    text: string;
    document?: EmailDocument;
    replyTo?: string | null;
    senderType?: string;
    mailboxId?: string | null;
  },
) {
  const [row] = await db
    .insert(campaigns)
    .values({
      organizationId,
      userId,
      name: input.name,
      subject: input.subject,
      fromName: input.fromName,
      fromEmail: input.fromEmail,
      document: input.document,
      htmlSnapshot: input.html,
      textSnapshot: input.text,
      status: "draft",
      replyTo: input.replyTo ?? null,
      senderType: input.senderType ?? "shared",
      mailboxId: input.mailboxId ?? null,
    })
    .returning();

  return row;
}

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
    replyTo?: string | null;
    senderType?: string;
    mailboxId?: string | null;
  },
) {
  const campaign = await getCampaignForUser(id, userId);
  if (!campaign) return null;

  const [row] = await db
    .update(campaigns)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.subject !== undefined ? { subject: input.subject } : {}),
      ...(input.fromName !== undefined ? { fromName: input.fromName } : {}),
      ...(input.fromEmail ? { fromEmail: input.fromEmail } : {}),
      ...(input.replyTo !== undefined ? { replyTo: input.replyTo } : {}),
      ...(input.senderType !== undefined ? { senderType: input.senderType } : {}),
      ...(input.mailboxId !== undefined ? { mailboxId: input.mailboxId } : {}),
      document: input.document,
      htmlSnapshot: input.html,
      textSnapshot: input.text,
    })
    .where(
      and(
        eq(campaigns.id, id),
        eq(campaigns.organizationId, campaign.organizationId),
        // Scheduled campaigns stay editable — the send reads the snapshot at
        // fire time, so edits before then are exactly what the user expects.
        sql`${campaigns.status} in ('draft', 'scheduled')`,
      ),
    )
    .returning();

  return row ?? null;
}

export async function listCampaignsForOrganization(organizationId: string) {
  return db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      subject: campaigns.subject,
      fromName: campaigns.fromName,
      fromEmail: campaigns.fromEmail,
      status: campaigns.status,
      createdAt: campaigns.createdAt,
      scheduledAt: campaigns.scheduledAt,
      sentAt: campaigns.sentAt,
      // Hand-qualified: drizzle renders interpolated columns unqualified here,
      // so `${campaigns.id}` becomes bare "id" and correlates against the
      // INNER table (always 0 matches). Qualify the outer reference by hand.
      audienceCount: sql<number>`(
        select count(*)::int from campaign_recipients cr
        where cr.campaign_id = campaigns.id
      )`,
      sentCount: sql<number>`(
        select count(*)::int from campaign_recipients cr
        where cr.campaign_id = campaigns.id
          and cr.status = 'sent'
      )`,
    })
    .from(campaigns)
    .where(eq(campaigns.organizationId, organizationId))
    .orderBy(desc(campaigns.createdAt));
}

export async function listCampaigns(userId: string) {
  const organization = await getDefaultOrganizationForUser(userId);
  if (!organization) return [];

  return listCampaignsForOrganization(organization.id);
}

export async function getCampaign(id: string) {
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return row ?? null;
}

export async function getCampaignForUser(id: string, userId: string) {
  const [row] = await db
    .select({ campaign: campaigns })
    .from(campaigns)
    .innerJoin(
      organizationMembers,
      eq(campaigns.organizationId, organizationMembers.organizationId),
    )
    .where(
      and(
        eq(campaigns.id, id),
        eq(organizationMembers.userId, userId),
      ),
    )
    .limit(1);

  return row?.campaign ?? null;
}

export async function deleteCampaign(id: string, userId: string): Promise<boolean> {
  const campaign = await getCampaignForUser(id, userId);
  if (!campaign) return false;

  const rows = await db
    .delete(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.organizationId, campaign.organizationId)))
    .returning({ id: campaigns.id });

  return rows.length > 0;
}

export async function markCampaignScheduled(id: string, scheduledAt: Date) {
  const [row] = await db
    .update(campaigns)
    .set({ status: "scheduled", scheduledAt })
    .where(
      and(
        eq(campaigns.id, id),
        sql`${campaigns.status} in ('draft', 'scheduled')`,
      ),
    )
    .returning();

  return row ?? null;
}

export async function cancelCampaignSchedule(id: string) {
  const [row] = await db
    .update(campaigns)
    .set({ status: "draft", scheduledAt: null })
    .where(and(eq(campaigns.id, id), eq(campaigns.status, "scheduled")))
    .returning();

  return row ?? null;
}

export async function markCampaignSending(id: string) {
  await db
    .update(campaigns)
    .set({ status: "sending", sentAt: new Date() })
    .where(eq(campaigns.id, id));
}

/**
 * Mark a campaign fully sent.
 *
 * Returns whether THIS call performed the transition. The guard on
 * status = 'sending' already made the write idempotent, but callers could not
 * tell the difference between "I finished it" and "it was already finished",
 * and anything that should happen exactly once at completion needs that
 * distinction: QStash delivers at least once and several workers can see the
 * last recipient drain at the same moment. See notifyCampaignFinished.
 */
export async function markCampaignSent(id: string): Promise<boolean> {
  const rows = await db
    .update(campaigns)
    .set({ status: "sent" })
    .where(and(eq(campaigns.id, id), eq(campaigns.status, "sending")))
    .returning({ id: campaigns.id });
  return rows.length > 0;
}

/**
 * Claim the right to send this campaign's one deliverability alert.
 *
 * The alert fires from the SES webhook, which is invoked once per bounce and
 * has no idea whether a sibling invocation is doing the same thing right now.
 * Stamping the campaign inside the same statement that checks the stamp makes
 * the claim atomic, so exactly one caller gets a row back and everyone else
 * gets null.
 *
 * Returns the campaign facts the alert needs, so the winner does not need a
 * second read.
 */
export async function claimDeliverabilityAlert(id: string) {
  const [row] = await db
    .update(campaigns)
    .set({ deliverabilityAlertSentAt: new Date() })
    .where(
      and(eq(campaigns.id, id), isNull(campaigns.deliverabilityAlertSentAt)),
    )
    .returning({
      name: campaigns.name,
      subject: campaigns.subject,
      organizationId: campaigns.organizationId,
    });
  return row ?? null;
}
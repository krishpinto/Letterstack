import { and, desc, eq, sql } from "drizzle-orm";
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
      document: input.document,
      htmlSnapshot: input.html,
      textSnapshot: input.text,
    })
    .where(
      and(
        eq(campaigns.id, id),
        eq(campaigns.organizationId, campaign.organizationId),
        eq(campaigns.status, "draft"),
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

export async function markCampaignSending(id: string) {
  await db
    .update(campaigns)
    .set({ status: "sending", sentAt: new Date() })
    .where(eq(campaigns.id, id));
}

export async function markCampaignSent(id: string) {
  await db
    .update(campaigns)
    .set({ status: "sent" })
    .where(and(eq(campaigns.id, id), eq(campaigns.status, "sending")));
}
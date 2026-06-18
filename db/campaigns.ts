import { and, desc, eq } from "drizzle-orm";
import { db } from "./client";
import { campaigns } from "./schema";

/** Create a draft campaign owned by `userId` — freezes the compiled content. */
export async function createCampaign(
  userId: string,
  input: {
    name: string;
    subject: string;
    fromName: string;
    fromEmail: string;
    html: string;
    text: string;
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
      htmlSnapshot: input.html, // frozen — what actually gets sent
      textSnapshot: input.text,
      status: "draft",
    })
    .returning();
  return row;
}

/** This user's campaigns, newest first. */
export async function listCampaigns(userId: string) {
  return db
    .select()
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

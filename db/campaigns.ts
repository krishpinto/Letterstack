import { desc, eq } from "drizzle-orm";
import { db } from "./client";
import { campaigns } from "./schema";

/** Create a draft campaign — freezes the already-compiled email content. */
export async function createCampaign(input: {
  name: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  html: string;
  text: string;
}) {
  const [row] = await db
    .insert(campaigns)
    .values({
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

/** All campaigns, newest first. */
export async function listCampaigns() {
  return db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
}

/** One campaign by id (or null). */
export async function getCampaign(id: string) {
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return row ?? null;
}

/** Flip a campaign to "sending" and stamp when the send started. */
export async function markCampaignSending(id: string) {
  await db
    .update(campaigns)
    .set({ status: "sending", sentAt: new Date() })
    .where(eq(campaigns.id, id));
}

import { desc } from "drizzle-orm";
import { db } from "./client";
import { emailEvents } from "./schema";

/** Record one SES event (Delivery / Bounce / Complaint / …). */
export async function recordEvent(email: string, type: string) {
  await db.insert(emailEvents).values({ email, type });
}

/** Read the most recent events — for the lab card. */
export async function listEvents(limit = 20) {
  return db.select().from(emailEvents).orderBy(desc(emailEvents.createdAt)).limit(limit);
}

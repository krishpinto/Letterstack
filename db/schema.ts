import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

/**
 * The shape of our database, described in TypeScript. This file is the
 * BLUEPRINT — it holds no data. `drizzle-kit push` reads it and builds the
 * matching tables inside Neon.
 *
 * First table: `recipients` — the people who receive a newsletter.
 * One row = one person.
 */
export const recipients = pgTable("recipients", {
  // A unique id for each person, generated automatically by the database.
  id: uuid("id").defaultRandom().primaryKey(),

  // Their email address. notNull() = every row MUST have one.
  email: text("email").notNull(),

  // Their name — optional (no .notNull()), so it can be left blank.
  name: text("name"),

  // The "sent checklist": when this person was last emailed.
  // null = not sent yet. A timestamp = already sent, so we skip them.
  // (Simplification for now: this tracks one implicit campaign. When we add a
  //  real `campaigns` table, sent-tracking moves to a per-campaign record.)
  sentAt: timestamp("sent_at"),

  // When the row was added. Filled in automatically with the current time.
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * The do-not-mail list. Any email here is NEVER sent to again — checked before
 * every send. Bounces and complaints land here automatically (Step 3b); manual
 * unsubscribes land here too.
 */
export const suppressedEmails = pgTable("suppressed_emails", {
  id: uuid("id").defaultRandom().primaryKey(),

  // The address to never email. unique() = the same address can't be added twice.
  email: text("email").notNull().unique(),

  // Why it's suppressed: "bounce" | "complaint" | "manual".
  reason: text("reason").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Every event SES reports back about an email: Delivery, Bounce, Complaint,
 * Open, Click… Fed by the webhook (SES → SNS → /api/webhooks/ses). Later the
 * analytics dashboard reads aggregates from this table.
 */
export const emailEvents = pgTable("email_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  type: text("type").notNull(), // "Bounce" | "Complaint" | "Delivery" | ...
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

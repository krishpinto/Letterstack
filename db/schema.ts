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

/**
 * One newsletter send. Self-contained: it carries a FROZEN snapshot of the
 * compiled email, so what gets sent is locked in and stays on record even if
 * the editor changes later.
 */
export const campaigns = pgTable("campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  fromName: text("from_name").notNull(),
  fromEmail: text("from_email").notNull(),
  htmlSnapshot: text("html_snapshot").notNull(), // frozen compiled HTML
  textSnapshot: text("text_snapshot").notNull(),
  status: text("status").notNull().default("draft"), // draft | sending | sent
  createdAt: timestamp("created_at").defaultNow().notNull(),
  sentAt: timestamp("sent_at"), // when the send was triggered
});

/**
 * The bridge: one row per (campaign, person). Each tracks how THAT person did
 * in THIS campaign. The monitor counts these by status to show progress.
 *
 * campaignId / recipientId are FOREIGN KEYS — they point at rows in the
 * campaigns / recipients tables.
 */
export const campaignRecipients = pgTable("campaign_recipients", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id),
  recipientId: uuid("recipient_id")
    .notNull()
    .references(() => recipients.id),
  email: text("email").notNull(), // copied here so the worker needn't re-join
  status: text("status").notNull().default("pending"), // pending | sent | failed
  sentAt: timestamp("sent_at"),
  error: text("error"),
});

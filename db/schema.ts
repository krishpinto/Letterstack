import { pgTable, uuid, text, timestamp, unique } from "drizzle-orm/pg-core";

// ── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Recipients ───────────────────────────────────────────────────────────────

export const recipients = pgTable(
  "recipients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Every recipient belongs to exactly one account. Cascade: deleting the
    // user removes their whole audience.
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name"),
    sentAt: timestamp("sent_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    // The same address can't be added twice BY THE SAME USER — but two
    // different users can each have it in their own list.
    unique("recipients_user_email_unq").on(t.userId, t.email),
  ],
);

/**
 * The do-not-mail list. Any email here is NEVER sent to again — checked before
 * every send. Bounces and complaints land here automatically (Step 3b); manual
 * unsubscribes land here too.
 */
export const suppressedEmails = pgTable(
  "suppressed_emails",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Whose do-not-mail list this entry belongs to. Each account keeps its own.
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // The address to never email.
    email: text("email").notNull(),

    // Why it's suppressed: "bounce" | "complaint" | "manual".
    reason: text("reason").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    // The same address can't be suppressed twice for the SAME user — but each
    // user has their own independent list.
    unique("suppressed_user_email_unq").on(t.userId, t.email),
  ],
);

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
  // Which account owns this campaign — used to scope the campaigns list.
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
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
  // onDelete cascade: deleting a campaign or a recipient also removes their
  // bridge rows, so deletes don't hit foreign-key constraint errors.
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  recipientId: uuid("recipient_id")
    .notNull()
    .references(() => recipients.id, { onDelete: "cascade" }),
  email: text("email").notNull(), // copied here so the worker needn't re-join
  status: text("status").notNull().default("pending"), // pending | sent | failed
  sentAt: timestamp("sent_at"),
  error: text("error"),
});

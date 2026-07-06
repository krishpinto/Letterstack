import { jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import type { EmailDocument } from "@/lib/email/document";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash").notNull(),
  sendingSlug: text("sending_slug"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("business"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Custom sending domains (e.g. "ciba.org") registered as SES identities.
// verifiedAt is set once SES confirms DKIM + MAIL FROM; only verified domains
// may appear in a campaign's From address. Unique globally: one org owns a
// domain at a time.
export const sendingDomains = pgTable("sending_domains", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  domain: text("domain").notNull().unique(),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("owner"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("organization_members_org_user_unq").on(
      table.organizationId,
      table.userId,
    ),
  ],
);

export const recipients = pgTable(
  "recipients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name"),
    sentAt: timestamp("sent_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("recipients_org_email_unq").on(table.organizationId, table.email),
  ],
);

export const suppressedEmails = pgTable(
  "suppressed_emails",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("suppressed_org_email_unq").on(table.organizationId, table.email),
  ],
);

export const emailEvents = pgTable("email_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  type: text("type").notNull(),
  campaignId: uuid("campaign_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const campaigns = pgTable("campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  fromName: text("from_name").notNull(),
  fromEmail: text("from_email").notNull(),
  document: jsonb("document").$type<EmailDocument>(),
  htmlSnapshot: text("html_snapshot").notNull(),
  textSnapshot: text("text_snapshot").notNull(),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
});

export const campaignRecipients = pgTable("campaign_recipients", {
  id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  recipientId: uuid("recipient_id")
    .references(() => recipients.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  name: text("name"),
  status: text("status").notNull().default("pending"),
  sentAt: timestamp("sent_at"),
  error: text("error"),
}, (table) => [unique("campaign_recipients_campaign_email_unq").on(table.campaignId, table.email)]);

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const recipientCategories = pgTable(
  "recipient_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => recipients.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("recipient_categories_unq").on(table.recipientId, table.categoryId),
  ],
);

export const emailTemplates = pgTable("email_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  subject: text("subject").default(""),
  fromName: text("from_name").default(""),
  fromEmail: text("from_email").default(""),
  document: jsonb("document").$type<EmailDocument>(),
  // Unguessable token backing the public share link (/templates/shared/<token>).
  // Null = not shared.
  shareToken: text("share_token").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

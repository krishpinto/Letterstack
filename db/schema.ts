import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import type { EmailDocument } from "@/lib/email/document";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  // Null for OAuth-only accounts (Google sign-in, no password set).
  passwordHash: text("password_hash"),
  sendingSlug: text("sending_slug"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const passwordResets = pgTable("password_resets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // sha256 of the raw token — the raw value only ever exists in the email link.
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("business"),
  // Beta send cap tracking: total marketing emails (campaigns + automations)
  // ever sent from this org. Incremented atomically at the point of send —
  // see tryReserveSendQuota in db/organizations.ts. Transactional emails
  // (password resets, invites) don't count against this.
  emailsSentCount: integer("emails_sent_count").notNull().default(0),
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

// Pending invites to join an organization. tokenHash is the sha256 of the
// raw token mailed to the invitee — same pattern as passwordResets, so a
// leaked table can't be replayed into a membership.
export const organizationInvites = pgTable("organization_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"),
  invitedByUserId: uuid("invited_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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

export const automations = pgTable("automations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // "enabled" automations run on trigger events; "disabled" ones are drafts.
  status: text("status").notNull().default("disabled"),
  // AutomationFlow (lib/automations/flow.ts): a node tree, not raw ReactFlow
  // state — the canvas derives its layout from this.
  flow: jsonb("flow").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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

// Embeddable newsletter signup forms. Each form is a public subscribe widget an
// org drops onto their own site (hosted page at /s/<publicKey>, or the injected
// script at /embed/<publicKey>). publicKey is the unguessable, revocable id that
// appears in those URLs — regenerating it kills every old embed at once.
//
// Signups are single opt-in: a valid submission is added to `recipients`
// immediately (no confirmation email). subscriberCount is a running tally of new
// subscribers, for the dashboard — attribution beyond that isn't tracked.
export const signupForms = pgTable("signup_forms", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Unguessable id in the embed/hosted URLs. Unique globally.
  publicKey: text("public_key").notNull().unique(),
  // Internal label shown only in the dashboard ("Website footer form").
  name: text("name").notNull(),
  headline: text("headline").notNull().default("Subscribe to our newsletter"),
  description: text("description")
    .notNull()
    .default("Get our latest updates straight to your inbox."),
  buttonLabel: text("button_label").notNull().default("Subscribe"),
  successMessage: text("success_message")
    .notNull()
    .default("You're subscribed — thanks for joining!"),
  // Hex accent for the button/link on the rendered widget.
  accentColor: text("accent_color").notNull().default("#4f46e5"),
  // Whether the widget asks for a name alongside the email.
  collectName: boolean("collect_name").notNull().default(false),
  // How the form appears on the host site. static: inline in the page.
  // popup: modal overlay. animated: slides in with motion.
  formType: text("form_type").notNull().default("static"),
  // Widget presentation. layout: card | minimal | inline. theme: light | dark.
  // cornerStyle: sharp | rounded | pill. Resolved to concrete styles at render.
  layout: text("layout").notNull().default("card"),
  theme: text("theme").notNull().default("light"),
  cornerStyle: text("corner_style").notNull().default("rounded"),
  // Running count of confirmed subscribers who came through this form.
  subscriberCount: integer("subscriber_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

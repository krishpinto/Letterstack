import {
  boolean,
  index,
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
  // Early-access gate: 'pending' | 'approved' | 'rejected'. New signups
  // default to pending; existing accounts were backfilled to approved in
  // migration 0006 so nothing regressed for current users. Checked in
  // proxy.ts before /dashboard, /editor, and /onboarding.
  accessStatus: text("access_status").notNull().default("pending"),
  accessDecidedAt: timestamp("access_decided_at"),
  accessDecidedByUserId: uuid("access_decided_by_user_id"),
  // Set the first time the /early-access page sends the "you're on the
  // list" email, so a pending user who reloads that page doesn't get a
  // second copy. Sending from there (rather than from signup/Google
  // sign-in) keeps the AWS SDK out of proxy.ts's edge bundle — lib/auth.ts
  // is shared with the edge middleware, but /early-access is a normal
  // Node.js server component.
  waitlistAppliedEmailSentAt: timestamp("waitlist_applied_email_sent_at"),
  // Set when this person dismisses the "you've got Pro free for 2 months"
  // announcement. Per-user rather than per-org so a second teammate still
  // gets told, and so dismissing it never hides it from someone else.
  planNoticeSeenAt: timestamp("plan_notice_seen_at"),
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
  // Start of the window emailsSentCount counts within. Plans are monthly, so
  // the counter rolls over when the calendar month does — see
  // tryReserveSendQuota, which resets it in the same atomic statement that
  // reserves, so a rollover can't race a concurrent send.
  emailsSentPeriodStart: timestamp("emails_sent_period_start"),
  // Paid tier. Defaults to "free" for every existing org, so nothing about
  // current behaviour changes until a payment settles. Nothing is gated on
  // this yet — it drives the Pro badge, and it's the hook real entitlements
  // (higher caps, etc.) attach to once pricing is decided.
  plan: text("plan").notNull().default("free"), // free | pro
  // When the paid period runs out. Null = no paid period. Renewal is manual
  // today: each purchase pushes this forward.
  planExpiresAt: timestamp("plan_expires_at"),
  // How this org came to be on `plan`: 'trial' (granted free, never paid) or
  // 'paid' (a payment settled). Both read as "pro" for entitlements — the
  // distinction is what the UI says and whether running out is a lapsed
  // trial ("your trial ended") or a lapsed subscription ("renew"). A paid
  // purchase during a trial overwrites this, so paying converts cleanly.
  planSource: text("plan_source").notNull().default("none"), // none | trial | paid
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Custom sending domains (e.g. "ciba.org") registered as SES identities.
// verifiedAt is set once SES confirms DKIM + MAIL FROM; only verified domains
// may appear in a campaign's From address. Unique globally: one org owns a
// domain at a time.
// Who has already had a free Pro period.
//
// Without this, the free period is just "make another account" away: sign up,
// send for two months, abandon the workspace, repeat. One row per identity
// that can claim one — the owning user, their organisation's email domain,
// and any sending domain they verify — so a second claim under any of those
// is recognised as the same people coming back.
//
// A row is never deleted by the app. Clearing one by hand is the deliberate
// way to re-grant a free period to someone who deserves a second look.
export const trialGrants = pgTable(
  "trial_grants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** 'user' | 'email_domain' | 'sending_domain' */
    kind: text("kind").notNull(),
    /** The user id, or the lowercased domain. */
    value: text("value").notNull(),
    /** The organization that first claimed it. Kept for support questions. */
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [unique("trial_grants_kind_value_unq").on(t.kind, t.value)],
);

export const sendingDomains = pgTable("sending_domains", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  domain: text("domain").notNull().unique(),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Razorpay order/payment lifecycle. One row per checkout attempt — created
// at "pay now" time (status "created"), updated to "paid"/"failed" only
// after the signature verifies server-side. No plan/pricing model exists
// yet, so this doesn't gate anything; it's purely a durable record that a
// payment happened, for the founder to reconcile manually until a real
// plan structure lands.
export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  razorpayOrderId: text("razorpay_order_id").notNull().unique(),
  razorpayPaymentId: text("razorpay_payment_id"),
  // Catalog key this order was for. Recorded at creation so settlement knows
  // what was bought without trusting anything the client says at that point.
  item: text("item").notNull().default("internal_test"),
  amount: integer("amount").notNull(), // paise
  currency: text("currency").notNull().default("INR"),
  receipt: text("receipt").notNull(),
  status: text("status").notNull().default("created"), // created | paid | failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  paidAt: timestamp("paid_at"),
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

// Append-only ledger of every model call the agent makes. This is both the
// billing record and the rate limiter: the daily, per-user and per-minute
// quota gates are all COUNT queries over this table. That's deliberate — at
// ~20 requests/minute Postgres is comfortably fast enough, and it avoids a
// second piece of infrastructure that can be down independently of the app.
// Failed calls are recorded too, because a failed call still consumed a
// request against the provider's daily ceiling.
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    // No FK: campaigns can be deleted while their usage history stays valid.
    campaignId: uuid("campaign_id"),
    ok: boolean("ok").notNull().default(true),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("ai_usage_created_at_idx").on(table.createdAt),
    index("ai_usage_user_created_at_idx").on(table.userId, table.createdAt),
  ],
);

export const aiBudgets = pgTable("ai_budgets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  monthlyTokenLimit: integer("monthly_token_limit").notNull().default(200_000),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

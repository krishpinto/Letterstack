// The admin API's row shapes as they arrive over the wire.
//
// Same fields as the types in db/admin-users.ts, with every Date already
// serialized to an ISO string by NextResponse.json. Kept here rather than
// imported from db/ so a client component never pulls the Drizzle module
// graph into the browser bundle.

import type { PlanKey } from "@/lib/plans/limits";

export type PlanSource = "none" | "trial" | "paid" | "granted";

export type AdminOrg = {
  id: string;
  name: string;
  type: string;
  role: string;
  plan: PlanKey;
  planSource: PlanSource;
  planExpiresAt: string | null;
  daysLeft: number | null;
  memberCount: number;
  contacts: number;
  suppressed: number;
  campaigns: number;
  emailsThisMonth: number;
  emailAllowance: number;
  contactAllowance: number;
  createdAt: string;
};

export type AdminUser = {
  userId: string;
  name: string | null;
  email: string;
  authMethod: "password" | "google";
  createdAt: string;
  organizations: AdminOrg[];
  topPlan: PlanKey;
  campaignsTotal: number;
  campaignsSent: number;
  emailsSent: number;
  lastSentAt: string | null;
  contacts: number;
};

export type AdminCampaign = {
  id: string;
  name: string;
  subject: string;
  status: string;
  organizationName: string;
  createdAt: string;
  scheduledAt: string | null;
  sentAt: string | null;
  recipients: number;
  sent: number;
  failed: number;
};

export type AdminUserDetail = AdminUser & {
  campaignHistory: AdminCampaign[];
};

export function planSourceLabel(source: PlanSource) {
  if (source === "paid") return "Paid";
  if (source === "trial") return "Trial";
  if (source === "granted") return "Admin grant";
  return "No plan";
}

export function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export type AdminCampaignRow = {
  id: string;
  name: string;
  subject: string;
  status: string;
  organizationId: string;
  organizationName: string;
  senderName: string | null;
  senderEmail: string;
  fromName: string;
  fromEmail: string;
  senderType: string;
  createdAt: string;
  scheduledAt: string | null;
  sentAt: string | null;
  recipients: number;
  sent: number;
  failed: number;
};

export type AdminCampaignDetail = AdminCampaignRow & {
  htmlSnapshot: string;
  textSnapshot: string;
  replyTo: string | null;
};

const SENDER_TYPE_LABELS: Record<string, string> = {
  shared: "Shared domain",
  domain: "Own domain",
  mailbox: "Gmail",
};

export function senderTypeLabel(senderType: string) {
  return SENDER_TYPE_LABELS[senderType] ?? senderType;
}

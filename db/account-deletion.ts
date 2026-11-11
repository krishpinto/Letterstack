// What deleting a user account does to everything that points at the user.
//
// Kept apart from db/users.ts so it has no database client and can be unit
// tested: the decisions live here, db/users.ts only executes them.
//
// Every foreign key to users.id falls in exactly one of three groups. The
// test next to this file fails when a new one is added without a decision.

import { apiKeys, automations, campaigns, recipients, signupForms } from "./schema";

/**
 * Org-scoped rows that record which member created them. They belong to the
 * workspace, not the member, so on account deletion the workspace's owner
 * becomes their creator. Their FKs are ON DELETE RESTRICT, so a code path
 * that forgets to do this fails instead of silently deleting them.
 */
export const REASSIGNED_TO_OWNER = [
  { table: recipients, column: recipients.userId },
  { table: campaigns, column: campaigns.userId },
  { table: signupForms, column: signupForms.userId },
  { table: automations, column: automations.userId },
  { table: apiKeys, column: apiKeys.createdByUserId },
] as const;

/**
 * Rows that must outlive the user but don't need a person attached: the FK
 * is ON DELETE SET NULL. Listed by "table.column".
 */
export const NULLED_ON_ACCOUNT_DELETION = [
  // A financial record; who paid is not worth deleting it over.
  "payments.user_id",
  // Losing the row would make a bounced or complained address mailable.
  "suppressed_emails.user_id",
  // Dead early-access column (see users in schema.ts).
  "users.access_decided_by_user_id",
] as const;

/**
 * Rows that are personal to the user and mean nothing without them: the FK
 * is ON DELETE CASCADE. Listed by "table.column".
 */
export const DELETED_WITH_ACCOUNT = [
  "password_resets.user_id",
  "organization_members.user_id",
  "notification_preferences.user_id",
  // A personal Gmail credential; campaigns.mailbox_id is SET NULL.
  "connected_mailboxes.user_id",
  "ai_budgets.user_id",
  // Per-user token accounting. The workspace loses this member's usage
  // history, which only fed per-user limits.
  "ai_usage.user_id",
  // An invite this person sent and nobody accepted yet.
  "organization_invites.invited_by_user_id",
] as const;

export type DeletionMembership = {
  organizationId: string;
  name: string;
  role: string;
  memberCount: number;
};

export type AccountDeletionPlan = {
  /** Shared workspaces this user is the owner of: deletion must wait. */
  blockingOrganizationNames: string[];
  /** Workspaces with nobody else in them: deleted along with the account. */
  soloOwnedOrganizationIds: string[];
};

export function planAccountDeletion(
  memberships: readonly DeletionMembership[],
): AccountDeletionPlan {
  const owned = memberships.filter((m) => m.role === "owner");
  return {
    blockingOrganizationNames: owned
      .filter((m) => m.memberCount > 1)
      .map((m) => m.name),
    soloOwnedOrganizationIds: owned
      .filter((m) => m.memberCount <= 1)
      .map((m) => m.organizationId),
  };
}

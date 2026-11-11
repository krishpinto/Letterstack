import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "./client";
import { getDefaultOrganizationForUser } from "./organizations";
import {
  campaignRecipients,
  campaigns,
  organizationMembers,
  recipients,
  suppressedEmails,
} from "./schema";

async function defaultOrganizationId(userId: string): Promise<string | null> {
  const organization = await getDefaultOrganizationForUser(userId);
  return organization?.id ?? null;
}

/**
 * Record a suppression. Returns true only when this call added the row — false
 * when the address was already suppressed in that workspace — so callers that
 * react to a *new* unsubscribe (automations) don't fire twice when the
 * one-click POST and the confirm page both land.
 */
export async function suppressEmailForOrganization(
  organizationId: string,
  userId: string,
  email: string,
  reason: string,
): Promise<boolean> {
  const rows = await db
    .insert(suppressedEmails)
    .values({ organizationId, userId, email, reason })
    .onConflictDoNothing({
      target: [suppressedEmails.organizationId, suppressedEmails.email],
    })
    .returning({ id: suppressedEmails.id });
  return rows.length > 0;
}

/**
 * The raw facts legacyUnsubscribeOrganizations (lib/email/unsubscribe.ts)
 * needs to resolve an unsubscribe token that predates the organization claim.
 * Read-only; the policy lives in that pure function.
 */
export async function legacyUnsubscribeSources(userId: string, email: string) {
  const memberRows = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId));
  const memberOrganizationIds = memberRows.map((row) => row.organizationId);

  const [campaignRows, recipientRows] = await Promise.all([
    // Campaigns this user sent to this address, in whichever workspace. This
    // still finds the workspace if the user has since left it.
    db
      .selectDistinct({ organizationId: campaigns.organizationId })
      .from(campaignRecipients)
      .innerJoin(campaigns, eq(campaigns.id, campaignRecipients.campaignId))
      .where(and(eq(campaigns.userId, userId), eq(campaignRecipients.email, email))),
    // Workspaces holding the address as a contact that this user belongs to
    // or added the contact in (automation sends signed tokens with the
    // contact owner's id).
    db
      .selectDistinct({ organizationId: recipients.organizationId })
      .from(recipients)
      .where(
        and(
          eq(recipients.email, email),
          memberOrganizationIds.length > 0
            ? or(
                eq(recipients.userId, userId),
                inArray(recipients.organizationId, memberOrganizationIds),
              )
            : eq(recipients.userId, userId),
        ),
      ),
  ]);

  return {
    campaignOrganizationIds: campaignRows.map((row) => row.organizationId),
    recipientOrganizationIds: recipientRows.map((row) => row.organizationId),
    memberOrganizationIds,
  };
}

export async function isSuppressedForOrganization(
  organizationId: string,
  email: string,
): Promise<boolean> {
  const rows = await db
    .select()
    .from(suppressedEmails)
    .where(
      and(
        eq(suppressedEmails.organizationId, organizationId),
        eq(suppressedEmails.email, email),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

export async function isSuppressed(userId: string, email: string): Promise<boolean> {
  const organizationId = await defaultOrganizationId(userId);
  if (!organizationId) return false;
  return isSuppressedForOrganization(organizationId, email);
}

export async function listSuppressedEmailsForOrganization(organizationId: string) {
  return db
    .select()
    .from(suppressedEmails)
    .where(eq(suppressedEmails.organizationId, organizationId))
    .orderBy(desc(suppressedEmails.createdAt));
}

export async function listSuppressedEmails(userId: string) {
  const organizationId = await defaultOrganizationId(userId);
  if (!organizationId) return [];
  return listSuppressedEmailsForOrganization(organizationId);
}

export async function listBouncedEmailsForOrganization(
  organizationId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ email: suppressedEmails.email })
    .from(suppressedEmails)
    .where(
      and(
        eq(suppressedEmails.organizationId, organizationId),
        inArray(suppressedEmails.reason, ["bounce", "complaint"]),
      ),
    );

  return new Set(rows.map((row) => row.email));
}

export async function listBouncedEmails(userId: string): Promise<Set<string>> {
  const organizationId = await defaultOrganizationId(userId);
  if (!organizationId) return new Set();
  return listBouncedEmailsForOrganization(organizationId);
}

export async function listSuppressedSetForOrganization(
  organizationId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ email: suppressedEmails.email })
    .from(suppressedEmails)
    .where(eq(suppressedEmails.organizationId, organizationId));

  return new Set(rows.map((row) => row.email));
}

export async function listSuppressedSet(userId: string): Promise<Set<string>> {
  const organizationId = await defaultOrganizationId(userId);
  if (!organizationId) return new Set();
  return listSuppressedSetForOrganization(organizationId);
}

import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "./client";
import { getDefaultOrganizationForUser } from "./organizations";
import { suppressedEmails } from "./schema";

async function defaultOrganizationId(userId: string): Promise<string | null> {
  const organization = await getDefaultOrganizationForUser(userId);
  return organization?.id ?? null;
}

export async function suppressEmailForOrganization(
  organizationId: string,
  userId: string,
  email: string,
  reason: string,
) {
  await db
    .insert(suppressedEmails)
    .values({ organizationId, userId, email, reason })
    .onConflictDoNothing({
      target: [suppressedEmails.organizationId, suppressedEmails.email],
    });
}

export async function suppressEmail(userId: string, email: string, reason: string) {
  const organizationId = await defaultOrganizationId(userId);
  if (!organizationId) return;
  await suppressEmailForOrganization(organizationId, userId, email, reason);
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

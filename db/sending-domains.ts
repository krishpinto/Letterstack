import { and, asc, eq } from "drizzle-orm";
import { db } from "./client";
import { sendingDomains } from "./schema";

/** Per-organization cap on connected sending domains. */
export const SENDING_DOMAIN_LIMIT = 3;

export async function listSendingDomains(organizationId: string) {
  return db
    .select()
    .from(sendingDomains)
    .where(eq(sendingDomains.organizationId, organizationId))
    .orderBy(asc(sendingDomains.createdAt));
}

/** Domains this org has verified and may therefore send from. */
export async function listVerifiedSendingDomains(
  organizationId: string,
): Promise<string[]> {
  const rows = await listSendingDomains(organizationId);
  return rows.filter((row) => row.verifiedAt).map((row) => row.domain);
}

/**
 * Attach a domain to the organization. Returns null when the org is at its
 * limit; throws on a unique violation (domain owned by another org).
 */
export async function addSendingDomain(organizationId: string, domain: string) {
  const existing = await listSendingDomains(organizationId);
  const already = existing.find((row) => row.domain === domain);
  if (already) return already;
  if (existing.length >= SENDING_DOMAIN_LIMIT) return null;

  const [row] = await db
    .insert(sendingDomains)
    .values({ organizationId, domain })
    .returning();
  return row;
}

export async function removeSendingDomain(
  organizationId: string,
  domain: string,
) {
  await db
    .delete(sendingDomains)
    .where(
      and(
        eq(sendingDomains.organizationId, organizationId),
        eq(sendingDomains.domain, domain),
      ),
    );
}

/** Record the latest SES verdict for one of the org's domains. */
export async function setSendingDomainVerified(
  organizationId: string,
  domain: string,
  verified: boolean,
) {
  await db
    .update(sendingDomains)
    .set({ verifiedAt: verified ? new Date() : null })
    .where(
      and(
        eq(sendingDomains.organizationId, organizationId),
        eq(sendingDomains.domain, domain),
      ),
    );
}

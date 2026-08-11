import { and, asc, eq } from "drizzle-orm";
import { db } from "./client";
import { organizations, sendingDomains } from "./schema";
import { activePlan } from "./organizations";
import { limitsFor, PLAN_LIMITS } from "@/lib/plans/limits";

/**
 * Fallback cap, used only when a caller has no plan context to hand. Real
 * enforcement reads the org's tier — see sendingDomainLimitFor. Kept equal to
 * the Pro allowance so an unplanned caller can never be stricter than the
 * tier the org is actually paying for.
 */
export const SENDING_DOMAIN_LIMIT = PLAN_LIMITS.pro.domains;

/** How many domains this org's current tier allows. */
export async function sendingDomainLimitFor(
  organizationId: string,
): Promise<number> {
  const [org] = await db
    .select({ plan: organizations.plan, planExpiresAt: organizations.planExpiresAt })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return limitsFor(activePlan(org ?? {})).domains;
}

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
  // Re-adding a domain already connected is a no-op, so it stays allowed even
  // at the limit — otherwise an org sitting exactly on its cap could never
  // re-run verification on a domain it already owns.
  if (already) return already;
  if (existing.length >= (await sendingDomainLimitFor(organizationId))) return null;

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

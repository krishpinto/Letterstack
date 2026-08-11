// The free-Pro-period ledger. See the trialGrants table for why it exists.
//
// The rule everywhere: a workspace gets a free period only if *none* of its
// identities has claimed one before. Checking several identities rather than
// one means the cheapest evasions — a second workspace, a second account on
// the same company domain, the same sending domain under a new login — all
// land on a row that already exists.

import { and, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "./client";
import { trialGrants } from "./schema";
import { organizationEmailDomain } from "@/lib/plans/email-domains";

export type TrialKey = { kind: "user" | "email_domain" | "sending_domain"; value: string };

/** The identities a new workspace would claim a free period against. */
export function trialKeysFor(input: {
  userId: string;
  email?: string | null;
}): TrialKey[] {
  const keys: TrialKey[] = [{ kind: "user", value: input.userId }];
  const domain = input.email ? organizationEmailDomain(input.email) : null;
  if (domain) keys.push({ kind: "email_domain", value: domain });
  return keys;
}

/**
 * Which of these identities has already used a free period. Returns the
 * matching rows rather than a boolean so a caller can say *why* — "this
 * domain already had one" is a support answer, "no" is not.
 */
export async function findClaimedTrialKeys(keys: TrialKey[]) {
  if (keys.length === 0) return [];
  return db
    .select()
    .from(trialGrants)
    .where(
      or(
        ...keys.map((key) =>
          and(eq(trialGrants.kind, key.kind), eq(trialGrants.value, key.value)),
        ),
      ),
    );
}

export async function hasClaimedTrial(keys: TrialKey[]): Promise<boolean> {
  return (await findClaimedTrialKeys(keys)).length > 0;
}

/**
 * Record that these identities have now used their free period.
 *
 * Conflicts are ignored rather than raised: two workspaces created in the
 * same instant would otherwise turn a race into a 500, and the row already
 * being there means exactly what we wanted to write.
 */
export async function claimTrialKeys(
  keys: TrialKey[],
  organizationId: string | null,
): Promise<void> {
  if (keys.length === 0) return;
  await db
    .insert(trialGrants)
    .values(
      keys.map((key) => ({
        kind: key.kind,
        value: key.value.trim().toLowerCase(),
        organizationId,
      })),
    )
    .onConflictDoNothing();
}

/**
 * Claim a sending domain for whichever org verified it first.
 *
 * Returns the existing row when another organization already holds it —
 * that's the signal that a free period is being taken twice under a new
 * account, since verifying a domain requires control of its DNS and can't be
 * faked the way an email address can.
 */
export async function claimSendingDomain(
  domain: string,
  organizationId: string,
): Promise<{ claimedByOther: boolean }> {
  const value = domain.trim().toLowerCase();

  const [existing] = await db
    .select()
    .from(trialGrants)
    .where(and(eq(trialGrants.kind, "sending_domain"), eq(trialGrants.value, value)))
    .limit(1);

  if (existing) {
    return { claimedByOther: existing.organizationId !== organizationId };
  }

  await db
    .insert(trialGrants)
    .values({ kind: "sending_domain", value, organizationId })
    .onConflictDoNothing();
  return { claimedByOther: false };
}

/** Every identity tied to one org, for the admin view and support questions. */
export async function listTrialGrantsForOrganizations(organizationIds: string[]) {
  if (organizationIds.length === 0) return [];
  return db
    .select()
    .from(trialGrants)
    .where(inArray(trialGrants.organizationId, organizationIds))
    .orderBy(sql`${trialGrants.createdAt} desc`);
}

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "./client";
import { apiKeys, apiKeyUsage } from "./schema";
import { generateApiKey, hashApiKey } from "@/lib/api/keys";
import type { ApiScope } from "@/lib/api/scopes";
import { normalizePlan, type PlanKey } from "@/lib/plans/limits";

/** The calendar month a usage row covers. UTC, so the reset time is one
 *  instant worldwide rather than whenever the server happens to be. */
export function currentPeriod(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Everything about a key except the secret, which we never hold. */
export type ApiKeySummary = {
  id: string;
  name: string;
  prefix: string;
  lastFour: string;
  scopes: ApiScope[];
  lastUsedAt: Date | null;
  createdAt: Date;
};

export async function createApiKey(
  organizationId: string,
  createdByUserId: string,
  name: string,
  scopes: ApiScope[],
): Promise<{ key: string; record: ApiKeySummary }> {
  const generated = generateApiKey();

  const [row] = await db
    .insert(apiKeys)
    .values({
      organizationId,
      createdByUserId,
      name,
      keyHash: generated.hash,
      prefix: generated.prefix,
      lastFour: generated.lastFour,
      scopes,
    })
    .returning();

  return {
    // The only time this value ever leaves the process. Not stored, not
    // logged, not recoverable — a lost key is replaced, never looked up.
    key: generated.key,
    record: {
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      lastFour: row.lastFour,
      scopes: (row.scopes ?? []) as ApiScope[],
      lastUsedAt: row.lastUsedAt,
      createdAt: row.createdAt,
    },
  };
}

/** Live keys for a workspace, newest first. Revoked ones stay in the table
 *  as an audit trail but are not shown. */
export async function listApiKeys(organizationId: string): Promise<ApiKeySummary[]> {
  const rows = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      lastFour: apiKeys.lastFour,
      scopes: apiKeys.scopes,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.organizationId, organizationId), isNull(apiKeys.revokedAt)))
    .orderBy(desc(apiKeys.createdAt));

  return rows.map((row) => ({ ...row, scopes: (row.scopes ?? []) as ApiScope[] }));
}

export type AuthenticatedKey = {
  id: string;
  organizationId: string;
  createdByUserId: string;
  scopes: ApiScope[];
};

/**
 * The authentication lookup: one indexed hit on the unique key_hash.
 *
 * Takes the raw key rather than a digest so no caller can accidentally hash
 * it the wrong way — the hashing lives in exactly one place.
 */
export async function findActiveApiKey(rawKey: string): Promise<AuthenticatedKey | null> {
  const [row] = await db
    .select({
      id: apiKeys.id,
      organizationId: apiKeys.organizationId,
      createdByUserId: apiKeys.createdByUserId,
      scopes: apiKeys.scopes,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hashApiKey(rawKey)))
    .limit(1);

  if (!row || row.revokedAt) return null;

  return {
    id: row.id,
    organizationId: row.organizationId,
    createdByUserId: row.createdByUserId,
    scopes: (row.scopes ?? []) as ApiScope[],
  };
}

/** Tombstone, not a delete — a revoked key's history is worth keeping, and
 *  the unique key_hash means the same secret can never be re-minted. */
export async function revokeApiKey(organizationId: string, id: string): Promise<boolean> {
  const rows = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiKeys.id, id),
        eq(apiKeys.organizationId, organizationId),
        isNull(apiKeys.revokedAt),
      ),
    )
    .returning({ id: apiKeys.id });

  return rows.length > 0;
}

/** Fire-and-forget: a failed timestamp write must never fail the request it
 *  was describing. */
export async function touchApiKeyLastUsed(id: string): Promise<void> {
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, id))
    .catch(() => {});
}

export type ApiRequestRecord = {
  /** The workspace's effective tier, after checking the paid period hasn't lapsed. */
  plan: PlanKey;
  /** Requests used this month, counting the one just recorded. */
  requests: number;
};

/**
 * Counts one request against the workspace's monthly allowance and reports
 * the tier to measure it against — in a single round trip.
 *
 * Both halves have to be read together. Reading the plan separately leaves a
 * window where a plan expiring mid-request gets its usage measured against
 * the wrong tier, which is the same reasoning checkContactHeadroom uses.
 *
 * The increment is an atomic UPSERT, so concurrent calls from several of the
 * customer's workers can't lose counts to a read-modify-write race.
 *
 * Requests that go on to be rejected are still counted. That is deliberate:
 * a client hammering a 429 should not get free retries.
 */
export async function recordApiRequest(
  organizationId: string,
  period = currentPeriod(),
): Promise<ApiRequestRecord> {
  const result = await db.execute<{ plan: string; requests: number }>(sql`
    WITH tier AS (
      SELECT CASE
               WHEN o.plan <> 'free'
                AND (o.plan_expires_at IS NULL OR o.plan_expires_at > now())
               THEN o.plan
               ELSE 'free'
             END AS plan
      FROM organizations o
      WHERE o.id = ${organizationId}
    ),
    bumped AS (
      INSERT INTO api_key_usage (organization_id, period, requests)
      VALUES (${organizationId}, ${period}, 1)
      ON CONFLICT (organization_id, period)
      DO UPDATE SET requests = api_key_usage.requests + 1
      RETURNING requests
    )
    SELECT tier.plan AS plan, bumped.requests AS requests
    FROM tier, bumped
  `);

  // db.execute returns either an array or a { rows } envelope depending on
  // the driver — same unwrapping as lib/plans/guards.ts.
  const row = Array.isArray(result)
    ? result[0]
    : (result as { rows?: unknown[] }).rows?.[0];
  const record = row as { plan: string; requests: number } | undefined;

  return {
    plan: normalizePlan(record?.plan),
    requests: Number(record?.requests ?? 0),
  };
}

/** This month's usage, for the settings panel. Read-only — never increments. */
export async function getApiUsage(
  organizationId: string,
  period = currentPeriod(),
): Promise<number> {
  const [row] = await db
    .select({ requests: apiKeyUsage.requests })
    .from(apiKeyUsage)
    .where(
      and(eq(apiKeyUsage.organizationId, organizationId), eq(apiKeyUsage.period, period)),
    )
    .limit(1);

  return row?.requests ?? 0;
}

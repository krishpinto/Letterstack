// Plan limit checks that need to look at the database.
//
// These run at the barrier — the moment someone tries to add the contact or
// connect the domain that would take them past their tier — rather than as a
// gate on the whole account. A workspace whose trial has lapsed keeps its
// lists, drafts, campaigns, and history; it is stopped only at the specific
// action that costs money, and told the number, the tier, and the way out.
//
// Nothing here deletes or hides anything. An org that ends its trial holding
// 2,544 contacts against a 500-contact free tier keeps all 2,544 — it simply
// cannot add the 2,545th. Enforcing on the stored total instead would punish
// people retroactively for data they added in good faith.

import { sql } from "drizzle-orm";

import { db } from "@/db/client";
import { limitMessage, limitsFor, normalizePlan, type PlanKey } from "./limits";

export type HeadroomResult = {
  ok: boolean;
  plan: PlanKey;
  used: number;
  limit: number;
  /** How many more may be added. Never negative. */
  remaining: number;
  /** Present only when ok is false. Safe to show to the person who hit it. */
  message?: string;
};

/**
 * Whether `adding` more contacts would fit. One query: the count and the
 * plan are read together so a plan expiring mid-check can't produce a
 * headroom figure computed against the wrong tier.
 */
export async function checkContactHeadroom(
  organizationId: string,
  adding: number,
): Promise<HeadroomResult> {
  const rows = await db.execute<{
    used: number;
    plan: string;
    active: boolean;
  }>(sql`
    SELECT
      (SELECT count(*)::int FROM recipients r WHERE r.organization_id = ${organizationId}) AS used,
      o.plan AS plan,
      (o.plan <> 'free' AND (o.plan_expires_at IS NULL OR o.plan_expires_at > now())) AS active
    FROM organizations o
    WHERE o.id = ${organizationId}
  `);

  const row = Array.isArray(rows) ? rows[0] : (rows as { rows?: unknown[] }).rows?.[0];
  const record = row as { used: number; plan: string; active: boolean } | undefined;

  // `active` only says the paid period hasn't lapsed — the tier itself comes
  // from the stored value, so Growth and Business get their own allowances
  // instead of every paid org being treated as Starter. normalizePlan turns
  // an unrecognised string into free, so `active` can never widen a limit on
  // its own.
  const plan: PlanKey = record?.active ? normalizePlan(record.plan) : "free";
  const used = Number(record?.used ?? 0);
  const limit = limitsFor(plan).contacts;
  const remaining = Math.max(0, limit - used);
  const ok = used + adding <= limit;

  return {
    ok,
    plan,
    used,
    limit,
    remaining,
    message: ok ? undefined : limitMessage("contacts", plan, used + adding),
  };
}

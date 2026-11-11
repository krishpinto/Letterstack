// Fixed-window rate limiting backed by Postgres, so every serverless instance
// shares one counter per key. The in-memory limiters elsewhere in the repo
// (lib/api/with-api-key.ts, the public subscribe route) only count requests
// that happen to land on the same warm instance, which on Vercel is close to
// none of them.
//
// One row per key. A hit is a single INSERT ... ON CONFLICT DO UPDATE, so two
// concurrent requests can't both read "4 of 5" and both pass: Postgres takes
// a row lock on the conflict and the second sees the first's count.

import { lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { rateLimits } from "@/db/schema";

export type RateLimitRule = {
  /** Requests allowed per window. */
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  ok: boolean;
  /** Seconds until the window resets. 0 when ok. */
  retryAfterSeconds: number;
};

export type WindowState = { windowStart: Date; count: number };

/**
 * The counter after one more hit. Mirrors the CASE expressions in `hit()`
 * exactly; it exists so that logic can be unit-tested without a database.
 * A window is over once windowMs has fully elapsed since it started.
 */
export function applyHit(
  previous: WindowState | null,
  now: Date,
  windowMs: number,
): WindowState {
  if (!previous || previous.windowStart.getTime() <= now.getTime() - windowMs) {
    return { windowStart: now, count: 1 };
  }
  return { windowStart: previous.windowStart, count: previous.count + 1 };
}

/** Whether a counter (already including this hit) is within the rule. */
export function evaluate(
  state: WindowState,
  now: Date,
  rule: RateLimitRule,
): RateLimitResult {
  if (state.count <= rule.limit) return { ok: true, retryAfterSeconds: 0 };
  const resetsAt = state.windowStart.getTime() + rule.windowMs;
  return {
    ok: false,
    retryAfterSeconds: Math.max(1, Math.ceil((resetsAt - now.getTime()) / 1000)),
  };
}

async function hit(key: string, rule: RateLimitRule, now: Date): Promise<WindowState> {
  const nowIso = now.toISOString();
  const cutoffIso = new Date(now.getTime() - rule.windowMs).toISOString();
  // Postgres evaluates every SET expression against the row as it was before
  // the update, so both CASEs test the same old window_start.
  const expired = sql`${rateLimits.windowStart} <= ${cutoffIso}::timestamptz`;

  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart: now, count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        windowStart: sql`CASE WHEN ${expired} THEN ${nowIso}::timestamptz ELSE ${rateLimits.windowStart} END`,
        count: sql`CASE WHEN ${expired} THEN 1 ELSE ${rateLimits.count} + 1 END`,
      },
    })
    .returning({ windowStart: rateLimits.windowStart, count: rateLimits.count });

  return row;
}

// Rows for keys nobody hits again would otherwise live forever. Sweeping on a
// small fraction of requests keeps the table bounded without a cron job.
const SWEEP_PROBABILITY = 0.01;
const SWEEP_AGE_MS = 24 * 60 * 60 * 1000;

async function maybeSweep(now: Date) {
  if (Math.random() >= SWEEP_PROBABILITY) return;
  await db
    .delete(rateLimits)
    .where(lt(rateLimits.windowStart, new Date(now.getTime() - SWEEP_AGE_MS)));
}

/**
 * Count one request against `key` and say whether it is allowed.
 *
 * Fails open: if the database call throws, the request is allowed and the
 * error is logged. These limits exist to slow down abuse; letting a database
 * blip lock every user out of logging in would be worse than the abuse.
 */
export async function rateLimit(
  key: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  const now = new Date();
  try {
    const state = await hit(key, rule, now);
    maybeSweep(now).catch(() => {});
    return evaluate(state, now, rule);
  } catch (err) {
    console.error(
      "rate-limit: check failed, allowing request:",
      err instanceof Error ? err.message : err,
    );
    return { ok: true, retryAfterSeconds: 0 };
  }
}

/**
 * Check several keys for one request (e.g. per-IP and per-email) and return
 * the first one over its limit. Every key is counted, even after one fails,
 * so an attacker can't dodge the per-email count by tripping the IP one.
 */
export async function rateLimitAll(
  checks: Array<{ key: string; rule: RateLimitRule }>,
): Promise<RateLimitResult> {
  const results = await Promise.all(checks.map((c) => rateLimit(c.key, c.rule)));
  const blocked = results.filter((r) => !r.ok);
  if (blocked.length === 0) return { ok: true, retryAfterSeconds: 0 };
  return {
    ok: false,
    retryAfterSeconds: Math.max(...blocked.map((r) => r.retryAfterSeconds)),
  };
}

/**
 * The caller's IP for keying limits. On Vercel both headers are set by the
 * platform from the real connection (it overwrites any client-supplied
 * X-Forwarded-For), so they can't be spoofed there. Off Vercel, behind no
 * proxy, they may be absent and every caller shares the "unknown" bucket.
 */
export function clientIp(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

/** A standard 429 body + Retry-After header for route handlers. */
export function tooManyRequests(result: RateLimitResult, message?: string) {
  const minutes = Math.ceil(result.retryAfterSeconds / 60);
  return Response.json(
    {
      ok: false,
      error:
        message ??
        `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
  );
}

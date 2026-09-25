/**
 * The only way a /api/v1 route is allowed to be written.
 *
 * Everything under app/api/v1 goes through this wrapper, which means a route
 * physically cannot be shipped without authentication, scope checking, plan
 * gating and quota accounting. That matters more than it sounds: the
 * session-authed internal routes are protected purely because each handler
 * remembers to call currentUserId() — proxy.ts doesn't match /api/* at all —
 * and "the author remembered" does not scale to a tree outsiders call.
 *
 * Two deliberate non-features:
 *
 * 1. NO CORS HEADERS. Their absence is the policy. A browser cannot make a
 *    cross-origin call here, which is what stops customers pasting a key
 *    into frontend JavaScript where every visitor can read it. Contrast
 *    /api/public/subscribe, which is wide open on purpose because its public
 *    form key can only do one harmless thing.
 * 2. No database access of its own beyond auth. Handlers call the same db/
 *    and lib/plans/ functions the dashboard calls, so the API is a second
 *    front door to the same house rather than a tunnel past the locks.
 */
import { NextResponse } from "next/server";

import { findActiveApiKey, recordApiRequest, touchApiKeyLastUsed } from "@/db/api-keys";
import { limitMessage, limitsFor, planAllowsApi } from "@/lib/plans/limits";
import { apiError } from "./errors";
import { bearerToken } from "./keys";
import type { ApiScope } from "./scopes";

export type ApiContext = {
  /** Every query a handler runs must be scoped to this. */
  organizationId: string;
  /** Author for rows the key writes. Not the thing being authenticated. */
  actorUserId: string;
  keyId: string;
  scopes: ApiScope[];
};

/**
 * Best-effort burst guard, per key.
 *
 * Honest about what it is: serverless instances are ephemeral and don't
 * share memory, so this only blunts a burst hitting one warm instance — the
 * same caveat /api/public/subscribe carries. The real ceiling is the durable
 * monthly counter in Postgres; this just stops one hot loop spending a
 * month's allowance in a minute.
 *
 * The upgrade is @upstash/ratelimit on Upstash Redis (same vendor as QStash,
 * so no new account), which would make this distributed and exact. It needs
 * UPSTASH_REDIS_REST_URL/TOKEN provisioned first, so it is left as a seam.
 */
const BURST_WINDOW_MS = 10_000;
const BURST_MAX = 50;
const burstHits = new Map<string, number[]>();

function burstLimited(keyId: string): boolean {
  const now = Date.now();
  const recent = (burstHits.get(keyId) ?? []).filter((t) => now - t < BURST_WINDOW_MS);
  recent.push(now);
  burstHits.set(keyId, recent);
  return recent.length > BURST_MAX;
}

export function withApiKey<Route>(
  scope: ApiScope,
  handler: (request: Request, ctx: ApiContext, route: Route) => Promise<Response>,
): (request: Request, route: Route) => Promise<Response> {
  return async (request, route) => {
    // Wraps the whole pipeline, not just the handler. Authentication and
    // quota accounting both hit the database, and a connection failure there
    // would otherwise escape to Next's default error page — HTML, from an
    // endpoint whose entire contract is JSON. A client parsing our errors
    // would throw on the response instead of reading the code.
    try {
      return await run(scope, handler, request, route);
    } catch (err) {
      // The caller gets a code and nothing else. Internal messages carry
      // table names, constraint names and ids that are none of their business.
      console.error(`api/v1 ${request.method} ${new URL(request.url).pathname} failed:`, err);
      return apiError(500, "internal_error", "Something went wrong on our end.");
    }
  };
}

async function run<Route>(
  scope: ApiScope,
  handler: (request: Request, ctx: ApiContext, route: Route) => Promise<Response>,
  request: Request,
  route: Route,
): Promise<Response> {
  const raw = bearerToken(request);
  if (!raw) {
    return apiError(
      401,
      "missing_api_key",
      "Send your key as an Authorization: Bearer <key> header.",
      // Tells a generic HTTP client how to authenticate rather than leaving
      // it to guess.
      { "WWW-Authenticate": 'Bearer realm="LetterStack API"' },
    );
  }

  const key = await findActiveApiKey(raw);
  if (!key) {
    // One message for "no such key" and "revoked key" on purpose: telling
    // the caller which one confirms that a guessed key once existed.
    return apiError(401, "invalid_api_key", "This API key is not valid or has been revoked.");
  }

  if (!key.scopes.includes(scope)) {
    return apiError(
      403,
      "insufficient_scope",
      `This key needs the "${scope}" scope. Add it in Settings → API & Integrations.`,
    );
  }

  if (burstLimited(key.id)) {
    return apiError(
      429,
      "rate_limited",
      `Too many requests. This key allows ${BURST_MAX} requests per ${BURST_WINDOW_MS / 1000} seconds.`,
      { "Retry-After": String(BURST_WINDOW_MS / 1000) },
    );
  }

  // Plan and monthly allowance, read and incremented in one round trip.
  const { plan, requests } = await recordApiRequest(key.organizationId);

  if (!planAllowsApi(plan)) {
    // 402 rather than 403: this is a "you could buy this" refusal, and the
    // billing panel is the way out.
    return apiError(402, "upgrade_required", limitMessage("api", plan));
  }

  const monthlyLimit = limitsFor(plan).apiRequestsPerMonth;
  if (requests > monthlyLimit) {
    return apiError(429, "quota_exceeded", limitMessage("api", plan));
  }

  void touchApiKeyLastUsed(key.id);

  const response = await handler(
    request,
    {
      organizationId: key.organizationId,
      actorUserId: key.createdByUserId,
      keyId: key.id,
      scopes: key.scopes,
    },
    route,
  );

  // Usage headers on every success, so an integrator can back off before
  // hitting the wall rather than discovering it as a 429.
  response.headers.set("X-RateLimit-Limit", String(monthlyLimit));
  response.headers.set("X-RateLimit-Remaining", String(Math.max(0, monthlyLimit - requests)));
  return response;
}

/**
 * A 405 for verbs a route doesn't implement. Without this, Next answers an
 * unhandled method with its own HTML error page, which breaks any client
 * that assumes JSON.
 */
export function methodNotAllowed(allowed: string[]): NextResponse {
  return apiError(405, "method_not_allowed", `Allowed: ${allowed.join(", ")}.`, {
    Allow: allowed.join(", "),
  });
}

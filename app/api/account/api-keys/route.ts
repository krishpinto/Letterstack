// Key management for the settings panel. Session-authed, NOT key-authed —
// an API key can never mint another API key, so a leaked key cannot quietly
// grant itself a permanent replacement.
//
// GET  — the workspace's live keys, without secrets
// POST — mint one, returning the raw key exactly once

import { NextResponse } from "next/server";

import { createApiKey, getApiUsage, listApiKeys } from "@/db/api-keys";
import { activePlan, getOrganizationForUser } from "@/db/organizations";
import { currentOrganizationId, currentUserId } from "@/lib/auth-helpers";
import { DEFAULT_SCOPES, parseScopes } from "@/lib/api/scopes";
import { limitMessage, limitsFor, planAllowsApi } from "@/lib/plans/limits";

export const runtime = "nodejs";

/** Minting a key is a privileged act — it hands out standing access to the
 *  whole workspace's audience — so it sits with owners and admins, not with
 *  every member who can be invited into a workspace. */
const MANAGE_ROLES = new Set(["owner", "admin"]);

async function requireWorkspace() {
  const userId = await currentUserId();
  if (!userId) return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };

  const organizationId = await currentOrganizationId();
  if (!organizationId) return { error: NextResponse.json({ ok: false, error: "No workspace" }, { status: 400 }) };

  const organization = await getOrganizationForUser(userId, organizationId);
  if (!organization) return { error: NextResponse.json({ ok: false, error: "No workspace" }, { status: 404 }) };

  return { userId, organizationId, organization };
}

export async function GET() {
  const scope = await requireWorkspace();
  if ("error" in scope) return scope.error;

  const plan = activePlan(scope.organization);
  const [keys, used] = await Promise.all([
    listApiKeys(scope.organizationId),
    getApiUsage(scope.organizationId),
  ]);

  return NextResponse.json({
    ok: true,
    keys: keys.map((key) => ({
      ...key,
      lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
      createdAt: key.createdAt.toISOString(),
    })),
    plan,
    allowed: planAllowsApi(plan),
    usage: { used, limit: limitsFor(plan).apiRequestsPerMonth },
    canManage: MANAGE_ROLES.has(scope.organization.role ?? ""),
  });
}

export async function POST(request: Request) {
  const scope = await requireWorkspace();
  if ("error" in scope) return scope.error;

  if (!MANAGE_ROLES.has(scope.organization.role ?? "")) {
    return NextResponse.json(
      { ok: false, error: "Only owners and admins can create API keys." },
      { status: 403 },
    );
  }

  const plan = activePlan(scope.organization);
  if (!planAllowsApi(plan)) {
    // 402 rather than 403: this is a "you could buy this" refusal, and the
    // billing panel is the way out.
    return NextResponse.json({ ok: false, error: limitMessage("api", plan) }, { status: 402 });
  }

  const body = (await request.json().catch(() => null)) as
    | { name?: unknown; scopes?: unknown }
    | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json(
      { ok: false, error: "Give the key a name so you know what to revoke later." },
      { status: 400 },
    );
  }

  const scopes = parseScopes(body?.scopes);
  const { key, record } = await createApiKey(
    scope.organizationId,
    scope.userId,
    name.slice(0, 80),
    scopes.length > 0 ? scopes : DEFAULT_SCOPES,
  );

  return NextResponse.json({
    ok: true,
    // The only response that will ever contain this. The client must show it
    // now; there is no endpoint that can retrieve it again.
    key,
    record: {
      ...record,
      lastUsedAt: null,
      createdAt: record.createdAt.toISOString(),
    },
  });
}

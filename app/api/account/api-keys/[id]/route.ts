// DELETE — revoke a key. Takes effect on the next request: findActiveApiKey
// checks revokedAt on every call, so there is no cache to wait out.

import { NextResponse } from "next/server";

import { revokeApiKey } from "@/db/api-keys";
import { getOrganizationForUser } from "@/db/organizations";
import { currentOrganizationId, currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

const MANAGE_ROLES = new Set(["owner", "admin"]);

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "No workspace" }, { status: 400 });
  }

  const organization = await getOrganizationForUser(userId, organizationId);
  if (!organization || !MANAGE_ROLES.has(organization.role ?? "")) {
    return NextResponse.json(
      { ok: false, error: "Only owners and admins can revoke API keys." },
      { status: 403 },
    );
  }

  const revoked = await revokeApiKey(organizationId, id);
  if (!revoked) {
    return NextResponse.json({ ok: false, error: "Key not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

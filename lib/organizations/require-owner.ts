// Shared authorization checks for organization-scoped API routes. Not a
// route.ts itself — App Router route files may only export HTTP method
// handlers and a small set of config constants, so this lives outside app/.

import { NextResponse } from "next/server";
import { getOrganizationForUser } from "@/db/organizations";
import { currentUserId } from "@/lib/auth-helpers";

export async function requireMember(organizationId: string) {
  const userId = await currentUserId();
  if (!userId) {
    return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }
  const organization = await getOrganizationForUser(userId, organizationId);
  if (!organization) {
    return {
      error: NextResponse.json({ ok: false, error: "Workspace not found" }, { status: 404 }),
    };
  }
  return { userId, organization };
}

export async function requireOwner(organizationId: string) {
  const result = await requireMember(organizationId);
  if (result.error) return result;
  if (result.organization!.role !== "owner") {
    return {
      error: NextResponse.json(
        { ok: false, error: "Only the workspace owner can do this" },
        { status: 403 },
      ),
    };
  }
  return result;
}

/**
 * Owner or admin. The middle tier: settings that change how the whole
 * workspace behaves — who it sends as, which domains it owns — rather than
 * settings that only affect the person changing them.
 *
 * Distinct from requireOwner, which guards the things that can destroy or
 * hand over the workspace itself. An admin is someone the owner invited to
 * help run the account, so locking them out of the sender identity would
 * mean every From-name change has to wait for one person.
 */
export async function requireManager(organizationId: string) {
  const result = await requireMember(organizationId);
  if (result.error) return result;
  const role = result.organization!.role;
  if (role !== "owner" && role !== "admin") {
    return {
      error: NextResponse.json(
        { ok: false, error: "Only owners and admins can change this" },
        { status: 403 },
      ),
    };
  }
  return result;
}

// A single organization, scoped to the caller's membership.
// PATCH  { name?, type? } — rename / re-type the workspace. Owner-only.
// DELETE                  — delete the workspace and everything scoped to
//                            it. Owner-only, and only if it's not the
//                            caller's last workspace (there's nowhere for
//                            the dashboard to send them otherwise).

import { NextResponse } from "next/server";
import {
  deleteOrganization,
  listOrganizationsForUser,
  normalizeOrganizationType,
  updateOrganization,
} from "@/db/organizations";
import { requireOwner } from "@/lib/organizations/require-owner";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { error } = await requireOwner(id);
  if (error) return error;

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const type = normalizeOrganizationType(body?.type);

  if (name.length < 2) {
    return NextResponse.json(
      { ok: false, error: "Organization name must be at least 2 characters" },
      { status: 400 },
    );
  }

  const organization = await updateOrganization(id, { name, type });
  if (!organization) {
    return NextResponse.json({ ok: false, error: "Workspace not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, organization });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { error, userId } = await requireOwner(id);
  if (error) return error;

  const remaining = await listOrganizationsForUser(userId);
  if (remaining.length <= 1) {
    return NextResponse.json(
      {
        ok: false,
        error: "This is your only workspace — create another one before deleting this one.",
      },
      { status: 400 },
    );
  }

  await deleteOrganization(id);
  return NextResponse.json({ ok: true });
}

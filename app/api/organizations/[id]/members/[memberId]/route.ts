// DELETE — remove a member, or leave (removing yourself). Owners can remove
// anyone but themselves; everyone else can only remove themselves.

import { NextResponse } from "next/server";
import {
  CannotRemoveSoleOwnerError,
  NotFoundInOrganizationError,
  NotOrganizationOwnerError,
  removeOrganizationMember,
} from "@/db/organizations";
import { requireMember } from "@/lib/organizations/require-owner";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const { id, memberId } = await params;
  const { error, userId, organization } = await requireMember(id);
  if (error) return error;

  try {
    await removeOrganizationMember(id, memberId, userId!, organization!.role);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof NotFoundInOrganizationError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 404 });
    }
    if (err instanceof NotOrganizationOwnerError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 403 });
    }
    if (err instanceof CannotRemoveSoleOwnerError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
    }
    console.error("DELETE /api/organizations/[id]/members/[memberId] failed", err);
    return NextResponse.json({ ok: false, error: "Could not remove member" }, { status: 500 });
  }
}

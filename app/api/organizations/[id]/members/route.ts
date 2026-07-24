// Members of a workspace. GET — any member can see the roster.

import { NextResponse } from "next/server";
import { listOrganizationMembers } from "@/db/organizations";
import { requireMember } from "@/lib/organizations/require-owner";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { error } = await requireMember(id);
  if (error) return error;

  const members = await listOrganizationMembers(id);
  return NextResponse.json({ ok: true, members });
}

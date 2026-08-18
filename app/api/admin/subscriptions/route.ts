import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { grantAdminPlan, listOrganizationsForAdmin } from "@/db/organizations";

export const runtime = "nodejs";

const MAX_GRANT_DAYS = 3650; // 10 years — generous ceiling against a fat-fingered grant, not a real limit

export async function GET() {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const organizations = await listOrganizationsForAdmin();
  return NextResponse.json({ ok: true, organizations });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const organizationId = typeof body?.organizationId === "string" ? body.organizationId : null;
  const days = Number(body?.days);

  if (!organizationId || !Number.isFinite(days) || days <= 0 || days > MAX_GRANT_DAYS) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const updated = await grantAdminPlan(organizationId, Math.round(days));
  if (!updated) {
    return NextResponse.json({ ok: false, error: "Organization not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, organization: updated });
}

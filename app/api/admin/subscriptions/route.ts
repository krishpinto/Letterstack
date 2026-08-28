import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { grantAdminPlan, listOrganizationsForAdmin } from "@/db/organizations";
import { isPlanKey } from "@/lib/plans/limits";

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
  // Which tier to grant. Omitted means Starter, so the existing callers keep
  // working unchanged. Free is rejected: this endpoint grants a paid period,
  // and "grant them Free" is really "end the period", which isn't this.
  const plan = body?.plan === undefined ? "pro" : body.plan;

  if (!organizationId || !Number.isFinite(days) || days <= 0 || days > MAX_GRANT_DAYS) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  if (!isPlanKey(plan) || plan === "free") {
    return NextResponse.json({ ok: false, error: "Unknown plan" }, { status: 400 });
  }

  const updated = await grantAdminPlan(organizationId, Math.round(days), plan);
  if (!updated) {
    return NextResponse.json({ ok: false, error: "Organization not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, organization: updated });
}

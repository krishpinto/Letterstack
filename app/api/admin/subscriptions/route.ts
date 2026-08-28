import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { listOrganizationsForAdmin, setAdminPlan } from "@/db/organizations";
import { isPlanKey } from "@/lib/plans/limits";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const organizations = await listOrganizationsForAdmin();
  return NextResponse.json({ ok: true, organizations });
}

/**
 * Set a workspace's plan outright: the body states the tier and the end date,
 * and both replace whatever was there.
 *
 * This is what the Users tab drives. `free` is accepted — that is how a plan
 * is removed — and so is a null expiry, which means the tier simply does not
 * run out.
 */
export async function PUT(request: Request) {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const organizationId =
    typeof body?.organizationId === "string" ? body.organizationId : null;
  const plan = body?.plan;

  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  if (!isPlanKey(plan)) {
    return NextResponse.json({ ok: false, error: "Unknown plan" }, { status: 400 });
  }

  // Absent or null both mean "no expiry". An unparseable or past date is
  // rejected rather than quietly coerced: silently writing an expiry in the
  // past would read as a granted plan while entitling nothing.
  let expiresAt: Date | null = null;
  if (body?.expiresAt !== undefined && body?.expiresAt !== null) {
    if (typeof body.expiresAt !== "string") {
      return NextResponse.json({ ok: false, error: "Invalid expiry" }, { status: 400 });
    }
    const parsed = new Date(body.expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ ok: false, error: "Invalid expiry" }, { status: 400 });
    }
    if (parsed.getTime() <= Date.now()) {
      return NextResponse.json(
        { ok: false, error: "Expiry is in the past" },
        { status: 400 },
      );
    }
    expiresAt = parsed;
  }

  const updated = await setAdminPlan(organizationId, plan, expiresAt);
  if (!updated) {
    return NextResponse.json({ ok: false, error: "Organization not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, organization: updated });
}

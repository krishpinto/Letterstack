import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createOrganizationInvite,
  listPendingInvitesForOrganization,
} from "@/db/invites";
import { sendOrganizationInviteEmail } from "@/lib/auth-emails";
import { currentOrganizationId, currentUserId } from "@/lib/auth-helpers";
import { getOrganizationForUser } from "@/db/organizations";
import { decideInviteRole, isManagerRole } from "@/lib/organizations/roles";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Organization required" }, { status: 428 });
  }

  const invites = await listPendingInvitesForOrganization(organizationId);
  return NextResponse.json({ ok: true, invites });
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Organization required" }, { status: 428 });
  }

  // currentOrganizationId already scopes to the caller's own memberships, but
  // we need the organization's name for the email and to reject a stale org id.
  const organization = await getOrganizationForUser(userId, organizationId);
  if (!organization) {
    return NextResponse.json({ ok: false, error: "Organization required" }, { status: 428 });
  }

  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();

  // Checked before anything else about the request, so a member learns
  // nothing from probing it. The caller's role comes from their membership
  // row, never from the request.
  const decision = decideInviteRole(organization.role, body?.role);
  if (!decision.ok) {
    const status = isManagerRole(organization.role) ? 400 : 403;
    return NextResponse.json({ ok: false, error: decision.error }, { status });
  }
  const role = decision.role;

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Valid email required" }, { status: 400 });
  }

  try {
    const session = await auth();
    const inviterName = session?.user?.name ?? session?.user?.email ?? "A teammate";

    const token = await createOrganizationInvite(organizationId, userId, email, role);
    await sendOrganizationInviteEmail(email, organization.name, inviterName, token);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

import { type NextRequest, NextResponse } from "next/server";
import {
  createOrganizationForUser,
  getActiveOrganizationForUser,
  getOrganizationForUser,
  listOrganizationsForUser,
  normalizeOrganizationType,
} from "@/db/organizations";
import {
  ACTIVE_ORGANIZATION_COOKIE,
  ACTIVE_ORGANIZATION_COOKIE_MAX_AGE,
} from "@/lib/active-organization";
import { currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function activeOrganizationIdFrom(request: NextRequest) {
  return request.cookies.get(ACTIVE_ORGANIZATION_COOKIE)?.value ?? null;
}

function withActiveOrganizationCookie(
  body: Record<string, unknown>,
  organizationId: string,
) {
  const response = NextResponse.json(body);
  response.cookies.set(ACTIVE_ORGANIZATION_COOKIE, organizationId, {
    httpOnly: true,
    maxAge: ACTIVE_ORGANIZATION_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

export async function GET(request: NextRequest) {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const [organization, organizations] = await Promise.all([
    getActiveOrganizationForUser(userId, activeOrganizationIdFrom(request)),
    listOrganizationsForUser(userId),
  ]);

  return NextResponse.json({ ok: true, organization, organizations });
}

export async function POST(request: NextRequest) {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const type = normalizeOrganizationType(body?.type);

  if (name.length < 2) {
    return NextResponse.json(
      { ok: false, error: "Organization name must be at least 2 characters" },
      { status: 400 },
    );
  }

  const organization = await createOrganizationForUser(userId, { name, type });
  const organizations = await listOrganizationsForUser(userId);

  return withActiveOrganizationCookie(
    { ok: true, organization, organizations },
    organization.id,
  );
}

export async function PATCH(request: NextRequest) {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const organizationId = String(body?.organizationId ?? "").trim();

  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json(
      { ok: false, error: "Valid organization id required" },
      { status: 400 },
    );
  }

  const organization = await getOrganizationForUser(userId, organizationId);
  if (!organization) {
    return NextResponse.json(
      { ok: false, error: "Organization not found" },
      { status: 404 },
    );
  }

  const organizations = await listOrganizationsForUser(userId);
  return withActiveOrganizationCookie(
    { ok: true, organization, organizations },
    organization.id,
  );
}
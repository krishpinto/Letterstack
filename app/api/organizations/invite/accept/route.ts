import { NextResponse } from "next/server";
import { acceptOrganizationInvite } from "@/db/invites";
import { currentUserId } from "@/lib/auth-helpers";
import { auth } from "@/lib/auth";
import {
  ACTIVE_ORGANIZATION_COOKIE,
  ACTIVE_ORGANIZATION_COOKIE_MAX_AGE,
} from "@/lib/active-organization";

export const runtime = "nodejs";

const ERROR_MESSAGES: Record<string, string> = {
  not_found: "This invite link is no longer valid.",
  expired: "This invite has expired — ask for a new one.",
  email_mismatch: "This invite was sent to a different email address.",
};

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const session = await auth();
  const userEmail = session?.user?.email;
  if (!userEmail) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const token = String(body?.token ?? "");
  if (!token) {
    return NextResponse.json({ ok: false, error: "Invite token required" }, { status: 400 });
  }

  const result = await acceptOrganizationInvite(token, userId, userEmail);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: ERROR_MESSAGES[result.error] ?? "Could not accept invite." },
      { status: 400 },
    );
  }

  const response = NextResponse.json({ ok: true, organizationId: result.organizationId });
  response.cookies.set(ACTIVE_ORGANIZATION_COOKIE, result.organizationId, {
    httpOnly: true,
    maxAge: ACTIVE_ORGANIZATION_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}

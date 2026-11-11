import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "./auth";
import { getActiveOrganizationForUser } from "@/db/organizations";
import { ACTIVE_ORGANIZATION_COOKIE } from "@/lib/active-organization";

/**
 * The current signed-in user's id, or null if there's no session. API routes
 * use this to scope every query to the caller — defense in depth alongside the
 * middleware (the middleware blocks anonymous access; this makes sure each
 * route only ever touches the caller's OWN rows).
 */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function currentOrganizationId(): Promise<string | null> {
  const userId = await currentUserId();
  if (!userId) return null;

  const cookieStore = await cookies();
  const activeOrganizationId =
    cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value ?? null;
  const organization = await getActiveOrganizationForUser(
    userId,
    activeOrganizationId,
  );

  return organization?.id ?? null;
}
/**
 * Whether the signed-in user has proven they own their email address (the
 * verification link, a password reset, or Google sign-in). False when
 * signed out.
 */
export async function isEmailVerified(): Promise<boolean> {
  const session = await auth();
  return Boolean(session?.user?.hasVerifiedEmail);
}

export const EMAIL_NOT_VERIFIED_MESSAGE =
  "Verify your email to send. Check your inbox for the confirmation link, or get a new one at /verify-email.";

/**
 * Guard for routes that send mail on the caller's behalf. Returns a 403 to
 * hand straight back, or null when the caller may proceed:
 *
 *   const unverified = await requireVerifiedEmail();
 *   if (unverified) return unverified;
 *
 * Without it, anyone could register an address they don't own and send
 * campaigns from an account that appears to belong to that person.
 */
export async function requireVerifiedEmail(): Promise<NextResponse | null> {
  if (await isEmailVerified()) return null;
  return NextResponse.json(
    { ok: false, error: EMAIL_NOT_VERIFIED_MESSAGE, code: "email_not_verified" },
    { status: 403 },
  );
}

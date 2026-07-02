import { cookies } from "next/headers";

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
import { auth } from "./auth";

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

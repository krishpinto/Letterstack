// Where to send someone after they sign in or sign up, given a callbackUrl
// from the query string. That value is attacker-controllable (anyone can
// link to /login?callbackUrl=...), so only paths on this site are accepted;
// anything else would make the login page an open redirect.

// Pages that would loop straight back into the auth flow.
const AUTH_PAGES = ["/login", "/signup"];

/**
 * A same-origin relative path to redirect to, or null to use the default.
 *
 * Accepts a relative path ("/dashboard/send?x=1") or an absolute URL on
 * `origin` (proxy.ts sets callbackUrl to the full request URL), which is
 * reduced to its path. Rejects other origins, protocol-relative "//host"
 * and "/\host" (browsers treat a backslash like a slash), and the auth pages.
 */
export function safeCallbackPath(
  raw: string | null | undefined,
  origin: string,
): string | null {
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;

  // new URL() normalises "/\evil.com" to an absolute URL on evil.com, which
  // the origin check above already rejects; this catches anything that
  // still renders as protocol-relative after normalisation.
  const path = `${url.pathname}${url.search}${url.hash}`;
  if (!path.startsWith("/") || path.startsWith("//")) return null;

  if (AUTH_PAGES.some((page) => url.pathname === page || url.pathname.startsWith(`${page}/`))) {
    return null;
  }
  return path;
}

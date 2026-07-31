import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getAccessStatus } from "@/db/access";

export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  // /lab and its API routes are unauthenticated dev tools (they can send mail
  // through SES and reset send state) — they must not exist in production.
  if (pathname.startsWith("/lab") || pathname.startsWith("/api/lab")) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.next();
  }

  // access_status is checked fresh from the DB on every request (never
  // cached in the JWT) because approval happens while the user is signed
  // out — a token claim would only refresh on next login anyway, so
  // caching it buys nothing and risks a stale "still pending" bounce right
  // after an admin approves someone.
  const userId = req.auth?.user?.id;
  const accessStatus = userId ? await getAccessStatus(userId) : null;

  // /early-access is the public "apply for early access" landing page —
  // reachable with NO session (that's the whole point: it's where an
  // anonymous visitor applies), not just by signed-in pending users. Only
  // approved users get bounced away from it, straight to the dashboard.
  if (pathname.startsWith("/early-access")) {
    if (accessStatus === "approved") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // "/" replaces the public marketing pitch with the early-access page for
  // anyone who isn't approved yet — anonymous visitors included. There is
  // no marketing site to browse during the invite-only beta.
  if (pathname === "/") {
    if (accessStatus !== "approved") {
      return NextResponse.redirect(new URL("/early-access", req.url));
    }
    return NextResponse.next();
  }

  // Everything else gated (/dashboard, /editor, /onboarding, /admin)
  // requires a real session — a direct deep link with no session goes to
  // /login, same as before.
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // /admin's authorization is independent (email allowlist checked inside
  // its API routes) — the early-access gate above must not couple to it.
  if (pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (accessStatus !== "approved") {
    return NextResponse.redirect(new URL("/early-access", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/editor/:path*",
    "/onboarding",
    "/early-access",
    "/admin/:path*",
    "/admin",
    "/lab/:path*",
    "/api/lab/:path*",
  ],
};

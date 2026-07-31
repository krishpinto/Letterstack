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

  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // /admin's authorization is independent (email allowlist checked inside
  // its API routes) — the early-access gate below must not couple to it.
  if (pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // Early-access gate. `/` itself is intentionally NOT matched by this
  // proxy at all (see config.matcher below) — it's the one page a
  // pending/rejected user can always reach, with the "join waitlist" CTA
  // and a status badge in its nav. Only the actual product surfaces below
  // require approval; a non-approved user bounces back to `/`, since
  // there's no separate holding page anymore.
  //
  // access_status is checked fresh from the DB on every request (never
  // cached in the JWT) because approval happens while the user is signed
  // out — a token claim would only refresh on next login anyway, so
  // caching it buys nothing and risks a stale "still pending" bounce right
  // after an admin approves someone.
  const userId = req.auth.user?.id;
  const accessStatus = userId ? await getAccessStatus(userId) : null;

  if (accessStatus !== "approved") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/editor/:path*",
    "/onboarding",
    "/admin/:path*",
    "/admin",
    "/lab/:path*",
    "/api/lab/:path*",
  ],
};

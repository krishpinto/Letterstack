import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
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

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/editor/:path*",
    "/onboarding",
    "/lab/:path*",
    "/api/lab/:path*",
  ],
};

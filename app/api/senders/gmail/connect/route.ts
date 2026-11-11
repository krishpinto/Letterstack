import { NextResponse } from "next/server";
import { buildGmailConsentUrl } from "@/lib/send/gmail-auth";
import {
  GMAIL_NONCE_COOKIE,
  GMAIL_STATE_MAX_AGE_MS,
  newGmailNonce,
} from "@/lib/send/gmail-state";
import { currentOrganizationId, currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Organization required" }, { status: 428 });
  }

  // The nonce goes into the signed state AND into a cookie only this browser
  // holds; the callback requires both to match (see lib/send/gmail-state.ts).
  // SameSite=Lax still sends it on Google's top-level redirect back to us.
  const nonce = newGmailNonce();
  const response = NextResponse.redirect(buildGmailConsentUrl(userId, organizationId, nonce));
  response.cookies.set(GMAIL_NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/senders/gmail/callback",
    maxAge: Math.floor(GMAIL_STATE_MAX_AGE_MS / 1000),
  });
  return response;
}

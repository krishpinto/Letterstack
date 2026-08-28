import { NextResponse } from "next/server";
import { buildGmailConsentUrl } from "@/lib/send/gmail-auth";
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

  return NextResponse.redirect(buildGmailConsentUrl(userId, organizationId));
}

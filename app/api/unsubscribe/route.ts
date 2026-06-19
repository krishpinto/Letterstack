// Public, unauthenticated unsubscribe endpoint. The token in `?t=` is a signed
// (userId, email) claim minted at send time, so we can suppress without a login
// and without trusting the URL contents.
//
// GET  — verify only (returns the email). We DON'T suppress on GET: link
//        scanners / mail prefetchers fire GETs and would unsubscribe people
//        who never clicked.
// POST — actually suppress. Serves both the RFC 8058 one-click flow (the mail
//        provider POSTs here directly) and our confirm page.

import { NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { suppressEmail } from "@/db/suppression";

export const runtime = "nodejs";

function tokenFrom(request: Request): string {
  return new URL(request.url).searchParams.get("t") ?? "";
}

export async function GET(request: Request) {
  const claim = verifyUnsubscribeToken(tokenFrom(request));
  if (!claim) {
    return NextResponse.json({ ok: false, error: "Invalid or expired link" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, email: claim.email });
}

export async function POST(request: Request) {
  const claim = verifyUnsubscribeToken(tokenFrom(request));
  if (!claim) {
    return NextResponse.json({ ok: false, error: "Invalid or expired link" }, { status: 400 });
  }
  await suppressEmail(claim.userId, claim.email, "unsubscribe");
  return NextResponse.json({ ok: true, email: claim.email });
}

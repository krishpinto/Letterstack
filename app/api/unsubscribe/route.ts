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
import { eq } from "drizzle-orm";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { suppressEmail } from "@/db/suppression";
import { db } from "@/db/client";
import { recipients } from "@/db/schema";
import { enqueueAutomationsForEvent } from "@/lib/automations/run";

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

  // Fire "contact unsubscribed" automations in every audience holding this
  // email. Suppression is already recorded, so a send node in such a flow
  // would skip this contact — these flows are for cleanup (tagging, removal).
  const rows = await db
    .select()
    .from(recipients)
    .where(eq(recipients.email, claim.email));
  for (const row of rows) {
    await enqueueAutomationsForEvent(row.organizationId, "contact.unsubscribed", [
      { id: row.id, email: row.email, name: row.name, userId: row.userId },
    ]);
  }

  return NextResponse.json({ ok: true, email: claim.email });
}

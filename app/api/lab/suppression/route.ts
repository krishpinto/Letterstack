// Lab endpoint for the suppression list. Calls the real query functions in
// db/suppression.ts — no logic here.

import { NextResponse } from "next/server";
import { listSuppressedEmails, suppressEmail } from "@/db/suppression";

export const runtime = "nodejs";

// GET = read the do-not-mail list.
export async function GET() {
  try {
    const rows = await listSuppressedEmails();
    return NextResponse.json({ ok: true, suppressed: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// POST = manually add an address (reason "manual").
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim();
    if (!email) {
      return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 });
    }
    await suppressEmail(email, "manual");
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

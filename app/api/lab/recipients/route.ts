// Server endpoint for the recipients lab card. It just calls the real query
// functions in db/recipients.ts and reports back — no DB logic lives here.

import { NextResponse } from "next/server";
import { addRecipient, listRecipients } from "@/db/recipients";

export const runtime = "nodejs";

// GET = read the current list.
export async function GET() {
  try {
    const rows = await listRecipients();
    return NextResponse.json({ ok: true, recipients: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// POST = add one person (the browser sends { email, name }).
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim();
    const name = String(body.name ?? "").trim();

    if (!email) {
      return NextResponse.json(
        { ok: false, error: "Email is required." },
        { status: 400 },
      );
    }

    const row = await addRecipient({ email, name: name || undefined });
    return NextResponse.json({ ok: true, recipient: row });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

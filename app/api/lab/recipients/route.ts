// Server endpoint for the recipients lab card. It just calls the real query
// functions in db/recipients.ts and reports back — no DB logic lives here.

import { NextResponse } from "next/server";
import { addRecipient, listRecipients } from "@/db/recipients";

export const runtime = "nodejs";

// Drizzle wraps DB errors in a vague "Failed query" message and tucks the real
// reason (e.g. 'relation "recipients" does not exist') in `.cause`. Dig it out.
function realError(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause;
    if (cause instanceof Error) return cause.message;
    return err.message;
  }
  return "Unknown error";
}

// GET = read the current list.
export async function GET() {
  try {
    const rows = await listRecipients();
    return NextResponse.json({ ok: true, recipients: rows });
  } catch (err) {
    return NextResponse.json({ ok: false, error: realError(err) }, { status: 500 });
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
    return NextResponse.json({ ok: false, error: realError(err) }, { status: 500 });
  }
}

// Lab endpoint for the suppression list. Calls the real query functions in
// db/suppression.ts — no logic here.

import { NextResponse } from "next/server";
import { listSuppressedEmails, suppressEmail } from "@/db/suppression";
import { currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

// Each account keeps its own do-not-mail list — every call is scoped to the
// signed-in user.
function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

// GET = read this user's do-not-mail list.
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  try {
    const rows = await listSuppressedEmails(userId);
    return NextResponse.json({ ok: true, suppressed: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// POST = manually add an address to this user's list (reason "manual").
export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim();
    if (!email) {
      return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 });
    }
    await suppressEmail(userId, email, "manual");
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

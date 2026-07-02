// Lab endpoint: read the most recent SES events so the card can show them.

import { NextResponse } from "next/server";
import { listEvents } from "@/db/events";

export const runtime = "nodejs";

export async function GET() {
  try {
    const events = await listEvents();
    return NextResponse.json({ ok: true, events });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

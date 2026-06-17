// The "doorbell" — the endpoint QStash calls back into. This proves QStash can
// actually reach your app. (In Step 2b, the real worker lives here and calls
// sendBatch(); for now it just records that it was rung.)

import { NextResponse } from "next/server";

export const runtime = "nodejs";

// DEV-ONLY memory of the last ring. Stored on globalThis so it survives Next's
// hot-reloads while you develop. The real worker won't use this — it writes to
// the database. This is just so the /lab card can SHOW you the callback landed.
type Ring = { at: string; payload: unknown };
const store = globalThis as unknown as { __qstashRing?: Ring };

// POST = QStash rings the doorbell, handing us the job's payload.
export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  store.__qstashRing = { at: new Date().toISOString(), payload };
  console.log("🔔 QStash rang the doorbell with:", payload);
  return NextResponse.json({ ok: true });
}

// GET = the browser asks "has QStash rung yet, and with what?"
export async function GET() {
  return NextResponse.json({ ok: true, ring: store.__qstashRing ?? null });
}

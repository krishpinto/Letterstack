// A tiny SERVER endpoint that proves we can reach Neon.
//
// It asks the database the simplest possible question — "what time is it?" —
// and hands back the answer. If this returns a timestamp, the connection,
// the password, and the network path are all working. No tables needed yet.

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export const runtime = "nodejs";

// GET = a read (we're only asking, not changing anything).
export async function GET() {
  try {
    // `sql\`...\`` lets us send raw SQL safely. `now()` is the database's clock.
    const result = await db.execute(sql`select now() as time`);
    const time = (result.rows[0] as { time: string }).time;
    return NextResponse.json({ ok: true, time });
  } catch (err) {
    // Wrong/expired DATABASE_URL or network issues land here.
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

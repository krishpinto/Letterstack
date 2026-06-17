// Testing helper for the lab: clears every "sent" stamp so the campaign can be
// re-sent from scratch. Not part of the real product — lab convenience only.

import { NextResponse } from "next/server";
import { resetSentFlags } from "@/db/recipients";

export const runtime = "nodejs";

export async function POST() {
  try {
    await resetSentFlags();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

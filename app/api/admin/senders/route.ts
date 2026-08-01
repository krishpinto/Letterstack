import { NextResponse } from "next/server";

import { listSenderStats } from "@/db/sender-stats";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

export const runtime = "nodejs";

// Founder-only. Same gate as the rest of /api/admin/*.
export async function GET() {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const senders = await listSenderStats();
  return NextResponse.json({ ok: true, senders });
}

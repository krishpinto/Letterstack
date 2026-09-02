import { NextResponse } from "next/server";

import { listAdminCampaigns } from "@/db/admin-campaigns";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

export const runtime = "nodejs";

// Founder-only. Same gate as the rest of /api/admin/* — a 404, not a 403, so
// the route is indistinguishable from one that does not exist.
export async function GET() {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const campaigns = await listAdminCampaigns();
  return NextResponse.json({ ok: true, campaigns });
}

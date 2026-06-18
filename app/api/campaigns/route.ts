// List all campaigns (newest first) for the campaigns dashboard page.

import { NextResponse } from "next/server";
import { listCampaigns } from "@/db/campaigns";

export const runtime = "nodejs";

export async function GET() {
  try {
    const campaigns = await listCampaigns();
    return NextResponse.json({ ok: true, campaigns });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

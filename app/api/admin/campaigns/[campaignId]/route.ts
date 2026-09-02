import { NextResponse } from "next/server";

import { getAdminCampaign } from "@/db/admin-campaigns";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

export const runtime = "nodejs";

// Founder-only. Same gate as the rest of /api/admin/*.
//
// Split from the list route because this is the one that returns a whole
// email body — keeping it behind its own request means the table never ships
// 200 snapshots to render 200 subject lines.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const { campaignId } = await params;
  const campaign = await getAdminCampaign(campaignId);
  if (!campaign) {
    return NextResponse.json(
      { ok: false, error: "Campaign not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, campaign });
}

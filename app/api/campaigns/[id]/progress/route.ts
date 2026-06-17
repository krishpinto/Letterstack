// Live progress for one campaign: status + counts by outcome. Polled by the
// monitor page every couple seconds.

import { NextResponse } from "next/server";
import { getCampaign } from "@/db/campaigns";
import { campaignProgress } from "@/db/campaign-recipients";

export const runtime = "nodejs";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  try {
    const campaign = await getCampaign(id);
    if (!campaign) {
      return NextResponse.json({ ok: false, error: "Campaign not found" }, { status: 404 });
    }
    const progress = await campaignProgress(id);
    return NextResponse.json({
      ok: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        subject: campaign.subject,
        status: campaign.status,
      },
      progress,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

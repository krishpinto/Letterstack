// Engagement for one campaign: delivered / opened / clicked / bounced /
// complained, aggregated from email_events (attributed via the SES campaignId
// message tag). Opens/clicks are estimates — privacy clients block the tracking
// pixel — so the UI must not present them as hard as delivered/bounced.

import { NextResponse } from "next/server";
import { getCampaignForUser } from "@/db/campaigns";
import { campaignEngagement, campaignUnsubscribes } from "@/db/events";
import { currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const campaign = await getCampaignForUser(id, userId);
  if (!campaign) {
    return NextResponse.json({ ok: false, error: "Campaign not found" }, { status: 404 });
  }

  const [engagement, unsubscribed] = await Promise.all([
    campaignEngagement(id),
    campaignUnsubscribes(id, campaign.organizationId, campaign.sentAt),
  ]);
  return NextResponse.json({ ok: true, engagement: { ...engagement, unsubscribed } });
}

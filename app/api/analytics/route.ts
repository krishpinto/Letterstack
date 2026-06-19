// Analytics overview: every sent/sending campaign for this user with its hard
// send numbers (from campaign_recipients) joined to its engagement (from
// email_events). One row per campaign for the analytics table.

import { NextResponse } from "next/server";
import { listCampaigns } from "@/db/campaigns";
import { engagementByCampaign } from "@/db/events";
import { currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

const EMPTY = {
  delivered: 0,
  bounced: 0,
  complained: 0,
  opensTotal: 0,
  opensUnique: 0,
  clicksTotal: 0,
  clicksUnique: 0,
};

export async function GET() {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const [campaigns, engagement] = await Promise.all([
    listCampaigns(userId),
    engagementByCampaign(userId),
  ]);

  const rows = campaigns
    .filter((c) => c.status !== "draft")
    .map((c) => ({
      id: c.id,
      name: c.name,
      subject: c.subject,
      status: c.status,
      sentAt: c.sentAt,
      audienceCount: c.audienceCount,
      sentCount: c.sentCount,
      engagement: engagement.get(c.id) ?? EMPTY,
    }));

  return NextResponse.json({ ok: true, campaigns: rows });
}

// POST — send a draft campaign now. Freezes the audience from the campaign's
// current snapshot and hands batches to QStash. Idempotent-ish: only a draft
// can be sent (startCampaign flips it to "sending").

import { NextResponse } from "next/server";
import { getCampaignForUser } from "@/db/campaigns";
import { startCampaign } from "@/lib/send/send-campaign";
import { currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const campaign = await getCampaignForUser(id, userId);
    if (!campaign) {
      return NextResponse.json({ ok: false, error: "Campaign not found" }, { status: 404 });
    }
    // "scheduled" is sendable too — Send now overrides the schedule, and the
    // delayed dispatch message no-ops once the status leaves "scheduled".
    if (campaign.status !== "draft" && campaign.status !== "scheduled") {
      return NextResponse.json(
        { ok: false, error: "Campaign has already been sent" },
        { status: 400 },
      );
    }

    const result = await startCampaign(id);
    return NextResponse.json({ ok: true, id, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// POST — send a draft (or scheduled) campaign now. Reads the pending
// audience, reserves quota for it, then claims the campaign with one guarded
// UPDATE; only the request that wins the claim queues batches. A second click,
// or the scheduled dispatch firing at the same moment, gets 409.

import { NextResponse } from "next/server";
import { getCampaignForUser } from "@/db/campaigns";
import { dispatchCampaign, SendRefusedError } from "@/lib/send/dispatch-campaign";
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
    if (campaign.status === "sending") {
      return NextResponse.json(
        { ok: false, error: "This campaign is already sending" },
        { status: 409 },
      );
    }
    // "scheduled" is sendable too — Send now overrides the schedule, and the
    // delayed dispatch message loses the claim when it arrives.
    if (campaign.status !== "draft" && campaign.status !== "scheduled") {
      return NextResponse.json(
        { ok: false, error: "Campaign has already been sent" },
        { status: 400 },
      );
    }

    const result = await dispatchCampaign(id, "now");
    if (result.outcome === "already_sending") {
      return NextResponse.json(
        { ok: false, error: "This campaign is already sending" },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true, id, ...result });
  } catch (err) {
    if (err instanceof SendRefusedError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

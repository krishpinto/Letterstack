// POST — send a draft campaign now, or resume one stuck mid-send. Freezes the
// audience from the campaign's current snapshot and hands batches to QStash.
// Idempotent: startCampaign only ever picks up recipients still "pending", so
// calling it again (a "sending" campaign whose batches stalled — e.g. a QStash
// batch exhausted its retries) just re-dispatches what never went out, and
// never re-sends to anyone already marked sent/failed.

import { NextResponse } from "next/server";
import { getCampaignForUser } from "@/db/campaigns";
import { countPendingForCampaign } from "@/db/campaign-recipients";
import { dispatchCampaign } from "@/lib/send/dispatch-campaign";
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
    // "sending" is resumable, but only if it actually stalled — otherwise a
    // second click while a send is genuinely in flight would double-dispatch
    // batches for recipients whose worker just hasn't reported back yet.
    const resumable =
      campaign.status === "sending" && (await countPendingForCampaign(id)) > 0;
    if (campaign.status !== "draft" && campaign.status !== "scheduled" && !resumable) {
      return NextResponse.json(
        { ok: false, error: "Campaign has already been sent" },
        { status: 400 },
      );
    }

    const result = await dispatchCampaign(id);
    return NextResponse.json({ ok: true, id, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

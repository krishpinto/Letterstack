// POST — schedule a draft campaign to send at a future time. The campaign is
// marked "scheduled" and a delayed QStash message targets the dispatch
// endpoint at that time. Rescheduling just re-POSTs: the row's scheduledAt is
// what the dispatch guard trusts, so stale messages no-op on arrival.
// DELETE — cancel the schedule and return the campaign to draft.

import { NextResponse } from "next/server";
import {
  cancelCampaignSchedule,
  getCampaignForUser,
  markCampaignScheduled,
} from "@/db/campaigns";
import { countRecipientsForCampaign } from "@/db/campaign-recipients";
import { appBaseUrl, publishQstashJSON } from "@/lib/send/qstash";
import { currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

const MIN_LEAD_MS = 2 * 60 * 1000; // at least 2 minutes out
const MAX_LEAD_MS = 30 * 24 * 60 * 60 * 1000; // at most 30 days out

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => null)) as { scheduledAt?: string } | null;
    const scheduledAt = body?.scheduledAt ? new Date(body.scheduledAt) : null;
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json(
        { ok: false, error: "Pick a valid date and time" },
        { status: 400 },
      );
    }

    const lead = scheduledAt.getTime() - Date.now();
    if (lead < MIN_LEAD_MS) {
      return NextResponse.json(
        { ok: false, error: "Schedule at least 2 minutes from now" },
        { status: 400 },
      );
    }
    if (lead > MAX_LEAD_MS) {
      return NextResponse.json(
        { ok: false, error: "Schedule within the next 30 days" },
        { status: 400 },
      );
    }

    const campaign = await getCampaignForUser(id, userId);
    if (!campaign) {
      return NextResponse.json({ ok: false, error: "Campaign not found" }, { status: 404 });
    }
    if (campaign.status !== "draft" && campaign.status !== "scheduled") {
      return NextResponse.json(
        { ok: false, error: "Campaign has already been sent" },
        { status: 400 },
      );
    }
    if ((await countRecipientsForCampaign(id)) === 0) {
      return NextResponse.json(
        { ok: false, error: "Add at least one recipient before scheduling" },
        { status: 400 },
      );
    }

    const updated = await markCampaignScheduled(id, scheduledAt);
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Campaign could not be scheduled" },
        { status: 409 },
      );
    }

    try {
      await publishQstashJSON({
        url: `${appBaseUrl()}/api/send/scheduled-dispatch`,
        notBefore: Math.floor(scheduledAt.getTime() / 1000),
        body: { campaignId: id, scheduledAtMs: scheduledAt.getTime() },
      });
    } catch (err) {
      // The delayed message never made it to QStash; don't leave a schedule
      // that will never fire.
      await cancelCampaignSchedule(id);
      throw err;
    }

    return NextResponse.json({
      ok: true,
      id,
      status: "scheduled",
      scheduledAt: scheduledAt.toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
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

    const reverted = await cancelCampaignSchedule(id);
    if (!reverted) {
      return NextResponse.json(
        { ok: false, error: "Campaign is not scheduled" },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, id, status: "draft" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

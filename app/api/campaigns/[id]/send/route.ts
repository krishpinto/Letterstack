// POST — send a draft (or scheduled) campaign now, or resume one that is
// already sending.
//
// Send: reads the pending audience, reserves quota for it, then claims the
// campaign with one guarded UPDATE; only the request that wins the claim
// queues batches. A second click, or the scheduled dispatch firing at the
// same moment, gets 409.
//
// Resume: re-queues only rows still pending and reserves nothing, so it is
// safe to press at any time; see resumeCampaign.

import { NextResponse } from "next/server";
import { getCampaignForUser } from "@/db/campaigns";
import {
  dispatchCampaign,
  QueueIncompleteError,
  resumeCampaign,
  SendRefusedError,
} from "@/lib/send/dispatch-campaign";
import { currentUserId, requireVerifiedEmail } from "@/lib/auth-helpers";

export const runtime = "nodejs";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const unverified = await requireVerifiedEmail();
  if (unverified) return unverified;

  try {
    const campaign = await getCampaignForUser(id, userId);
    if (!campaign) {
      return NextResponse.json({ ok: false, error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.status === "sending") {
      const result = await resumeCampaign(id, userId);
      switch (result.outcome) {
        case "resumed":
          return NextResponse.json({ ok: true, id, ...result });
        case "too_soon":
          return NextResponse.json(
            { ok: false, error: "This campaign was queued less than a minute ago. Give it a moment." },
            { status: 409 },
          );
        case "nothing_to_resume":
          return NextResponse.json(
            {
              ok: false,
              error:
                result.inFlight > 0
                  ? "Nothing is waiting to be queued; the remaining recipients are being sent right now."
                  : "Nothing is left to send.",
            },
            { status: 409 },
          );
        case "not_sending":
          return NextResponse.json(
            { ok: false, error: "This campaign is no longer sending" },
            { status: 409 },
          );
      }
    }

    // "scheduled" is sendable too — Send now overrides the schedule, and the
    // delayed dispatch message loses the claim when it arrives. So is
    // "failed": a send refused when its schedule fired can be retried once
    // the cause is fixed, and only still-pending rows go out.
    if (!["draft", "scheduled", "failed"].includes(campaign.status)) {
      return NextResponse.json(
        { ok: false, error: "Campaign has already been sent" },
        { status: 400 },
      );
    }

    const result = await dispatchCampaign(id, "now", userId);
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
    if (err instanceof QueueIncompleteError) {
      // The campaign is sending; part of it is not queued yet. 502 rather
      // than 500: the failure is QStash's, and Resume fixes it.
      return NextResponse.json({ ok: false, error: err.message }, { status: 502 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

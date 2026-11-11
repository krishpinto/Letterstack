// QStash-delivered endpoint that fires when a scheduled campaign's time
// arrives. Cancels and reschedules never delete the delayed message — instead
// this endpoint trusts only the campaign row: it sends only if the campaign
// is still "scheduled" AND the row's scheduledAt matches the time baked into
// this message. A stale message (canceled, or rescheduled to another time)
// arrives, matches nothing, and no-ops.

import { NextResponse } from "next/server";
import { getCampaign } from "@/db/campaigns";
import {
  dispatchCampaign,
  ensureCampaignQueued,
  failCampaign,
  SendRefusedError,
} from "@/lib/send/dispatch-campaign";
import {
  appBaseUrl,
  publishQstashJSON,
  qstashNotBefore,
} from "@/lib/send/qstash";
import { verifyQstashRequest } from "@/lib/send/qstash-worker";

export const runtime = "nodejs";
// Reads the audience, reserves quota and publishes every batch. 60s is the
// most Vercel Hobby allows without Fluid compute.
export const maxDuration = 60;

// Postgres keeps microseconds and JS keeps milliseconds; allow a small skew
// when matching the message's timestamp against the row.
const MATCH_TOLERANCE_MS = 2000;

export async function POST(request: Request) {
  const body = await verifyQstashRequest(request, "/api/send/scheduled-dispatch");
  if (body === null) {
    return NextResponse.json(
      { ok: false, error: "Invalid or missing QStash signature" },
      { status: 401 },
    );
  }

  try {
    const { campaignId, scheduledAtMs } = JSON.parse(body) as {
      campaignId: string;
      scheduledAtMs: number;
    };

    const campaign = await getCampaign(campaignId);
    if (!campaign) {
      // Deleted after scheduling — nothing to do, and retrying won't help.
      return NextResponse.json({ ok: true, skipped: "campaign missing" });
    }
    const rowMs = campaign.scheduledAt?.getTime() ?? 0;
    const matchesRow = Math.abs(rowMs - scheduledAtMs) <= MATCH_TOLERANCE_MS;

    // QStash retrying this message after an attempt that claimed the
    // campaign but did not get every batch onto the queue. The claim
    // happening at or after the scheduled time is what says it was this
    // schedule that started it, not an earlier "Send now". Re-running the
    // round queues only what is missing; see ensureCampaignQueued.
    if (
      campaign.status === "sending" &&
      matchesRow &&
      (campaign.sentAt?.getTime() ?? 0) >= rowMs - MATCH_TOLERANCE_MS
    ) {
      const queued = await ensureCampaignQueued(campaignId);
      return NextResponse.json({ ok: true, ensured: true, ...queued });
    }

    if (campaign.status !== "scheduled") {
      return NextResponse.json({ ok: true, skipped: "not scheduled" });
    }
    if (!matchesRow) {
      return NextResponse.json({ ok: true, skipped: "rescheduled" });
    }

    // Send times beyond QStash's max delay arrive here early, in hops: sleep
    // another max-delay stretch and check again.
    if (rowMs - Date.now() > MATCH_TOLERANCE_MS) {
      await publishQstashJSON({
        url: `${appBaseUrl()}/api/send/scheduled-dispatch`,
        notBefore: qstashNotBefore(rowMs),
        body: { campaignId, scheduledAtMs },
      });
      console.log(
        `scheduled-dispatch: campaign ${campaignId} not due yet — hopped toward ${new Date(rowMs).toISOString()}`,
      );
      return NextResponse.json({ ok: true, hopped: true });
    }

    let result;
    try {
      result = await dispatchCampaign(campaignId, "schedule");
    } catch (err) {
      // Over quota, no one to send to, an unusable sender: retrying will not
      // change any of these, and nobody is watching to fix them. Record the
      // failure on the campaign, tell the owner, and answer 2xx so QStash
      // stops. Anything else (a database blip) still answers 500 and is
      // retried.
      if (err instanceof SendRefusedError) {
        await failCampaign(campaignId, err.message, ["scheduled"]);
        console.log(`scheduled-dispatch: campaign ${campaignId} failed - ${err.message}`);
        return NextResponse.json({ ok: true, failed: err.message });
      }
      throw err;
    }
    if (result.outcome === "already_sending") {
      // "Send now" claimed it between our read and our claim.
      return NextResponse.json({ ok: true, skipped: "already sending" });
    }
    console.log(
      `scheduled-dispatch: campaign ${campaignId} started - ${result.total} recipients in ${result.batches} batches`,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

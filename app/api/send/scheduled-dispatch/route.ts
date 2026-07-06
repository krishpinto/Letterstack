// QStash-delivered endpoint that fires when a scheduled campaign's time
// arrives. Cancels and reschedules never delete the delayed message — instead
// this endpoint trusts only the campaign row: it sends only if the campaign
// is still "scheduled" AND the row's scheduledAt matches the time baked into
// this message. A stale message (canceled, or rescheduled to another time)
// arrives, matches nothing, and no-ops.

import { NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { getCampaign } from "@/db/campaigns";
import { startCampaign } from "@/lib/send/send-campaign";
import {
  appBaseUrl,
  publishQstashJSON,
  qstashNotBefore,
} from "@/lib/send/qstash";

export const runtime = "nodejs";

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

// Postgres keeps microseconds and JS keeps milliseconds; allow a small skew
// when matching the message's timestamp against the row.
const MATCH_TOLERANCE_MS = 2000;

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("upstash-signature") ?? "";

  const isValid = await receiver.verify({ body, signature }).catch(() => false);
  if (!isValid) {
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
    if (campaign.status !== "scheduled") {
      return NextResponse.json({ ok: true, skipped: "not scheduled" });
    }
    const rowMs = campaign.scheduledAt?.getTime() ?? 0;
    if (Math.abs(rowMs - scheduledAtMs) > MATCH_TOLERANCE_MS) {
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

    const result = await startCampaign(campaignId);
    console.log(
      `scheduled-dispatch: campaign ${campaignId} started - ${result.total} recipients in ${result.batches} batches`,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { countSendingAmong } from "@/db/campaign-recipients";
import { sendGmailChunk, type GmailRunPayload } from "@/lib/send/gmail-campaign";
import { RetryableSendError } from "@/lib/send/send-campaign";
import {
  scheduleSettleCheck,
  settleCampaign,
  verifyQstashRequest,
} from "@/lib/send/qstash-worker";

export const runtime = "nodejs";
// Vercel Hobby allows 60s without Fluid compute and 300s with it. A chunk
// is sized to finish well inside 60s (GMAIL_CHUNK_SIZE), so this holds on
// either setting.
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await verifyQstashRequest(request, "/api/send/gmail-campaign-worker");
  if (body === null) {
    return NextResponse.json(
      { ok: false, error: "Invalid or missing QStash signature" },
      { status: 401 },
    );
  }

  try {
    const payload = JSON.parse(body) as GmailRunPayload;

    const result = await sendGmailChunk(payload);

    // A reconnect halt leaves the rest "pending" on purpose; settling is
    // still safe because pending rows keep the campaign open.
    if (payload.campaignId) {
      await settleCampaign(payload.campaignId);
      if ((await countSendingAmong(result.chunk)) > 0) {
        await scheduleSettleCheck(payload.campaignId);
      }
    }

    console.log(
      `gmail-campaign-worker: chunk done - sent ${result.sent}, failed ${result.failed}, unrecorded ${result.unrecorded}` +
        (result.haltedForReconnect ? " (halted: mailbox needs reconnecting)" : "") +
        (result.continued ? " (next chunk queued)" : ""),
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof RetryableSendError) {
      // Not a failure of this batch: QStash retries it with backoff, and the
      // retry skips every row already sent.
      console.warn(`gmail-campaign-worker: retrying later - ${err.message}`);
      return NextResponse.json({ ok: false, retry: true, error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

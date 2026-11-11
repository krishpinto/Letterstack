import { NextResponse } from "next/server";
import { countSendingAmong } from "@/db/campaign-recipients";
import {
  RetryableSendError,
  sendCampaignBatch,
  type FrozenContent,
} from "@/lib/send/send-campaign";
import {
  scheduleSettleCheck,
  settleCampaign,
  verifyQstashRequest,
} from "@/lib/send/qstash-worker";

export const runtime = "nodejs";
// One batch of 50 is three small queries and one SES call per row, about
// 20s at worst. 60s is the most Vercel Hobby allows without Fluid compute.
export const maxDuration = 60;

type Payload =
  | { settleOnly: true; campaignId: string }
  | {
      settleOnly?: false;
      content: FrozenContent;
      userId: string;
      organizationId: string;
      campaignId?: string;
      campaignRecipientIds: string[];
    };

export async function POST(request: Request) {
  const body = await verifyQstashRequest(request, "/api/send/campaign-worker");
  if (body === null) {
    return NextResponse.json(
      { ok: false, error: "Invalid or missing QStash signature" },
      { status: 401 },
    );
  }

  try {
    const payload = JSON.parse(body) as Payload;

    // A delayed check from scheduleSettleCheck: nothing to send, only settle
    // claims that have timed out and close the campaign if that finishes it.
    if (payload.settleOnly) {
      const { inFlight } = await settleCampaign(payload.campaignId);
      if (inFlight > 0) await scheduleSettleCheck(payload.campaignId);
      return NextResponse.json({ ok: true, settled: true, inFlight });
    }

    const { content, userId, organizationId, campaignId } = payload;
    const ids = payload.campaignRecipientIds ?? [];

    const result = await sendCampaignBatch(content, ids, userId, organizationId, campaignId);

    if (campaignId) {
      await settleCampaign(campaignId);
      // Rows of this batch still "sending" are held by a duplicate delivery,
      // or by an attempt that died holding them. Come back once their claims
      // have timed out so the campaign cannot stay "sending" forever.
      if ((await countSendingAmong(ids)) > 0) await scheduleSettleCheck(campaignId);
    }

    console.log(
      `campaign-worker: batch done - sent ${result.sent}, failed ${result.failed}, unrecorded ${result.unrecorded}`,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof RetryableSendError) {
      // Not a failure of this batch: QStash retries it with backoff, and the
      // retry skips every row already sent.
      console.warn(`campaign-worker: retrying later - ${err.message}`);
      return NextResponse.json({ ok: false, retry: true, error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

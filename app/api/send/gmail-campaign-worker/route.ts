import { NextResponse } from "next/server";
import { countSendingAmong } from "@/db/campaign-recipients";
import { sendGmailCampaignBatch } from "@/lib/send/gmail-campaign";
import { RetryableSendError, type FrozenContent } from "@/lib/send/send-campaign";
import {
  scheduleSettleCheck,
  settleCampaign,
  verifyQstashRequest,
} from "@/lib/send/qstash-worker";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await verifyQstashRequest(request, "/api/send/gmail-campaign-worker");
  if (body === null) {
    return NextResponse.json(
      { ok: false, error: "Invalid or missing QStash signature" },
      { status: 401 },
    );
  }

  try {
    const { content, userId, organizationId, mailboxId, campaignId, campaignRecipientIds } =
      JSON.parse(body) as {
        content: FrozenContent;
        userId: string;
        organizationId: string;
        mailboxId: string;
        campaignId?: string;
        campaignRecipientIds: string[];
      };
    const ids = campaignRecipientIds ?? [];

    const result = await sendGmailCampaignBatch(content, ids, userId, organizationId, mailboxId);

    // A reconnect halt leaves the rest "pending" on purpose; settling is
    // still safe because pending rows keep the campaign open.
    if (campaignId) {
      await settleCampaign(campaignId);
      if ((await countSendingAmong(ids)) > 0) await scheduleSettleCheck(campaignId);
    }

    console.log(
      `gmail-campaign-worker: batch done - sent ${result.sent}, failed ${result.failed}, unrecorded ${result.unrecorded}` +
        (result.haltedForReconnect ? " (halted: mailbox needs reconnecting)" : ""),
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

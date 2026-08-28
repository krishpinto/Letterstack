import { NextResponse } from "next/server";
import { listPendingByIds } from "@/db/campaign-recipients";
import { sendGmailCampaignBatch } from "@/lib/send/gmail-campaign";
import type { FrozenContent } from "@/lib/send/send-campaign";
import { finalizeCampaignIfDone, verifyQstashRequest } from "@/lib/send/qstash-worker";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await verifyQstashRequest(request);
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

    const rows = await listPendingByIds(campaignRecipientIds ?? []);
    const result = await sendGmailCampaignBatch(content, rows, userId, organizationId, mailboxId);

    // A reconnect halt is not "done" — recipients past the halt point are
    // still pending on purpose, so skip finalizing until they've actually
    // gone out via a later Resume.
    if (!result.haltedForReconnect) {
      await finalizeCampaignIfDone(campaignId);
    }

    console.log(
      `gmail-campaign-worker: batch done - sent ${result.sent}, failed ${result.failed}` +
        (result.haltedForReconnect ? " (halted: mailbox needs reconnecting)" : ""),
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

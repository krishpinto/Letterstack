import { NextResponse } from "next/server";
import { listPendingByIds } from "@/db/campaign-recipients";
import { sendCampaignBatch, type FrozenContent } from "@/lib/send/send-campaign";
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
    const { content, userId, organizationId, campaignId, campaignRecipientIds } = JSON.parse(body) as {
      content: FrozenContent;
      userId: string;
      organizationId: string;
      campaignId?: string;
      campaignRecipientIds: string[];
    };

    const rows = await listPendingByIds(campaignRecipientIds ?? []);
    const result = await sendCampaignBatch(content, rows, userId, organizationId, campaignId);
    await finalizeCampaignIfDone(campaignId);

    console.log(`campaign-worker: batch done - sent ${result.sent}, failed ${result.failed}`);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

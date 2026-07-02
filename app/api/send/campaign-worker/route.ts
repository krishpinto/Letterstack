import { NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { countPendingForCampaign, listPendingByIds } from "@/db/campaign-recipients";
import { markCampaignSent } from "@/db/campaigns";
import { sendCampaignBatch, type FrozenContent } from "@/lib/send/send-campaign";

export const runtime = "nodejs";

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

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
    const { content, userId, organizationId, campaignId, campaignRecipientIds } = JSON.parse(body) as {
      content: FrozenContent;
      userId: string;
      organizationId: string;
      campaignId?: string;
      campaignRecipientIds: string[];
    };

    const rows = await listPendingByIds(campaignRecipientIds ?? []);
    const result = await sendCampaignBatch(content, rows, userId, organizationId, campaignId);

    if (campaignId && (await countPendingForCampaign(campaignId)) === 0) {
      await markCampaignSent(campaignId);
    }

    console.log(`campaign-worker: batch done - sent ${result.sent}, failed ${result.failed}`);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

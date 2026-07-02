// POST — reuse a sent campaign: clone it into a fresh DRAFT (same design,
// subject, sender, and audience) and return the new draft's id. The original
// stays untouched as the immutable sent record its analytics point at.

import { NextResponse } from "next/server";
import { createCampaign, getCampaignForUser } from "@/db/campaigns";
import {
  addCampaignRecipientsBulk,
  listCampaignRecipients,
} from "@/db/campaign-recipients";
import { currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
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
    if (campaign.status === "draft") {
      return NextResponse.json(
        { ok: false, error: "This campaign is still a draft — edit it directly" },
        { status: 400 },
      );
    }

    const draft = await createCampaign(userId, campaign.organizationId, {
      name: campaign.name,
      subject: campaign.subject,
      fromName: campaign.fromName,
      fromEmail: campaign.fromEmail,
      html: campaign.htmlSnapshot,
      text: campaign.textSnapshot,
      document: campaign.document ?? undefined,
    });

    // Carry the audience over as fresh pending rows so the new draft is one
    // edit away from re-sending to the same list.
    const audience = await listCampaignRecipients(campaign.id);
    if (audience.length > 0) {
      await addCampaignRecipientsBulk(
        draft.id,
        audience.map((r) => ({ email: r.email, name: r.name })),
      );
    }

    return NextResponse.json({ ok: true, id: draft.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { addCampaignRecipientsBulk } from "@/db/campaign-recipients";
import { getCampaignForUser } from "@/db/campaigns";
import { listRecipientsForOrganization } from "@/db/recipients";
import { listSuppressedSetForOrganization } from "@/db/suppression";
import { currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const campaign = await getCampaignForUser(id, userId);
  if (!campaign) {
    return NextResponse.json({ ok: false, error: "Campaign not found" }, { status: 404 });
  }
  if (campaign.status !== "draft") {
    return NextResponse.json(
      { ok: false, error: "Audience can only be changed before sending" },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const requestedIds = Array.isArray(body?.recipientIds)
    ? new Set(body.recipientIds.map(String))
    : null;

  const [organizationAudience, suppressed] = await Promise.all([
    listRecipientsForOrganization(campaign.organizationId),
    listSuppressedSetForOrganization(campaign.organizationId),
  ]);

  const selected = requestedIds
    ? organizationAudience.filter((recipient) => requestedIds.has(recipient.id))
    : organizationAudience;
  const allowed = selected.filter((recipient) => !suppressed.has(recipient.email));
  const inserted = await addCampaignRecipientsBulk(
    campaign.id,
    allowed.map((recipient) => ({
      recipientId: recipient.id,
      email: recipient.email,
      name: recipient.name,
    })),
  );

  return NextResponse.json({
    ok: true,
    summary: {
      selected: selected.length,
      imported: inserted.length,
      duplicates: allowed.length - inserted.length,
      suppressed: selected.length - allowed.length,
    },
  });
}
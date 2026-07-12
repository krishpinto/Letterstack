import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, recipientCategories } from "@/db/schema";
import { addCampaignRecipientsBulk } from "@/db/campaign-recipients";
import { getCampaignForUser } from "@/db/campaigns";
import { listRecipientsForOrganization } from "@/db/recipients";
import { listSuppressedSetForOrganization } from "@/db/suppression";
import { currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

// Copies people from the org's master audience onto this campaign's frozen
// recipient snapshot. Three shapes of request, in order of how people send:
//   { categoryIds: [...] }   → everyone in those folders
//   { recipientIds: [...] }  → a hand-picked subset
//   (no body)                → the entire audience ("Everyone")
// Suppressed addresses are always dropped before insert.
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
  // `categoryIds` present (even as []) means "restrict to these folders". An
  // explicit empty array therefore selects nobody — only an absent key means
  // "everyone".
  const folderIds = Array.isArray(body?.categoryIds)
    ? body.categoryIds.filter((item: unknown): item is string => typeof item === "string")
    : null;

  const [organizationAudience, suppressed] = await Promise.all([
    listRecipientsForOrganization(campaign.organizationId),
    listSuppressedSetForOrganization(campaign.organizationId),
  ]);

  // Resolve which org recipients live in the requested folders. Joined through
  // `categories` so a caller can't pull people via another org's folder id.
  let folderRecipientIds: Set<string> | null = null;
  if (folderIds) {
    folderRecipientIds = new Set();
    if (folderIds.length > 0) {
      const rows = await db
        .select({ recipientId: recipientCategories.recipientId })
        .from(recipientCategories)
        .innerJoin(categories, eq(recipientCategories.categoryId, categories.id))
        .where(
          and(
            eq(categories.organizationId, campaign.organizationId),
            inArray(recipientCategories.categoryId, folderIds),
          ),
        );
      folderRecipientIds = new Set(rows.map((row) => row.recipientId));
    }
  }

  let selected = organizationAudience;
  if (requestedIds) {
    selected = selected.filter((recipient) => requestedIds.has(recipient.id));
  }
  if (folderRecipientIds) {
    selected = selected.filter((recipient) => folderRecipientIds.has(recipient.id));
  }

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

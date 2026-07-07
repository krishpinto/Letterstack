import { NextResponse } from "next/server";
import { addCampaignRecipientsBulk, listCampaignRecipients } from "@/db/campaign-recipients";
import { getCampaignForUser } from "@/db/campaigns";
import { listSuppressedSetForOrganization } from "@/db/suppression";
import { currentUserId } from "@/lib/auth-helpers";
import { validateEmails } from "@/lib/import/validation";

export const runtime = "nodejs";

const MAX_ROWS = 50_000;

type Incoming = { email?: unknown; name?: unknown };

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

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
      { ok: false, error: "Audience can only be imported before sending" },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const contacts: Incoming[] = Array.isArray(body?.contacts) ? body.contacts : [];
  if (contacts.length === 0) {
    return NextResponse.json({ ok: false, error: "No rows to import" }, { status: 400 });
  }
  if (contacts.length > MAX_ROWS) {
    return NextResponse.json(
      { ok: false, error: `That's over the ${MAX_ROWS.toLocaleString()}-row limit for one import` },
      { status: 400 },
    );
  }

  const [existing, suppressed] = await Promise.all([
    listCampaignRecipients(id),
    listSuppressedSetForOrganization(campaign.organizationId),
  ]);
  const existingSet = new Set(existing.map((row) => row.email));

  // Stage 1 filter: syntax + disposable + role + MX/DNS, deduped by domain.
  const { results, report } = await validateEmails(
    contacts.map((row) => String(row.email ?? "")),
  );

  const seen = new Set<string>();
  const toInsert: { email: string; name: string | null }[] = [];
  let duplicates = 0;
  let suppressedCount = 0;
  let roleFlagged = 0;

  results.forEach((result, index) => {
    if (result.status !== "valid") return;

    const email = result.email;
    if (seen.has(email) || existingSet.has(email)) {
      duplicates++;
      return;
    }
    if (suppressed.has(email)) {
      suppressedCount++;
      return;
    }

    const name = String(contacts[index].name ?? "").trim() || null;
    seen.add(email);
    toInsert.push({ email, name });
    if (result.flags.includes("role")) roleFlagged++;
  });

  const inserted = await addCampaignRecipientsBulk(id, toInsert);

  return NextResponse.json({
    ok: true,
    summary: {
      received: contacts.length,
      imported: inserted.length,
      duplicates,
      invalid: report.invalidSyntax,
      deadDomain: report.deadDomain,
      disposable: report.disposable,
      roleFlagged,
      typos: report.typos,
      suppressed: suppressedCount,
    },
  });
}

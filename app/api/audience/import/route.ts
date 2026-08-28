import { NextResponse } from "next/server";
import {
  addRecipientsBulk,
  listRecipientsForOrganization,
} from "@/db/recipients";
import { listSuppressedSetForOrganization } from "@/db/suppression";
import { enqueueAutomationsForEvent } from "@/lib/automations/run";
import { currentOrganizationId, currentUserId } from "@/lib/auth-helpers";
import { validateEmails } from "@/lib/import/validation";
import { checkContactHeadroom } from "@/lib/plans/guards";
import { nextPlanUp, PLAN_LIMITS } from "@/lib/plans/limits";

export const runtime = "nodejs";

const MAX_ROWS = 50_000;

type Incoming = { email?: unknown; name?: unknown };

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Organization required" }, { status: 428 });
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
    listRecipientsForOrganization(organizationId),
    listSuppressedSetForOrganization(organizationId),
  ]);
  const existingSet = new Set(existing.map((recipient) => recipient.email));

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
    // Dropped by the validator (bad syntax, dead domain, disposable) — already
    // tallied in `report`, nothing more to do.
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

  // `toInsert` is already net of duplicates and suppressions, so this asks
  // about the contacts that would genuinely be added. Refused whole rather
  // than truncated: a half-imported list leaves someone guessing which
  // people made it in, which is worse than importing nothing.
  const headroom = await checkContactHeadroom(organizationId, toInsert.length);
  if (!headroom.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          `This file adds ${toInsert.length.toLocaleString()} new contacts, but only ` +
          `${headroom.remaining.toLocaleString()} of your ${headroom.limit.toLocaleString()} ` +
          `contacts are still free. Nothing was imported. ` +
          // Names the tier that would actually fit them, rather than always
          // Starter — someone already on Starter needs to hear "Growth".
          (nextPlanUp(headroom.plan)
            ? `Upgrade to ${PLAN_LIMITS[nextPlanUp(headroom.plan)!].label} in Settings → Billing for more.`
            : "Contact us if you need a higher limit."),
        limit: headroom.limit,
        used: headroom.used,
        attempted: toInsert.length,
      },
      { status: 402 },
    );
  }

  const inserted = await addRecipientsBulk(organizationId, userId, toInsert);

  // Fire "contact added" automations for imported contacts. Capped so a huge
  // import can't fan out tens of thousands of welcome emails in one shot.
  await enqueueAutomationsForEvent(
    organizationId,
    "contact.added",
    inserted.slice(0, 1_000).map((recipient) => ({
      id: recipient.id,
      email: recipient.email,
      name: recipient.name,
      userId: recipient.userId,
    })),
  );

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
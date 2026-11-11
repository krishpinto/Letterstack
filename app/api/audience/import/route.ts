import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { addRecipientsBulk } from "@/db/recipients";
import { categories, recipientCategories, recipients } from "@/db/schema";
import { listSuppressedSetForOrganization } from "@/db/suppression";
import { enqueueAutomationsForEvent } from "@/lib/automations/run";
import { currentOrganizationId, currentUserId } from "@/lib/auth-helpers";
import {
  IMPORT_AUTOMATION_CAP,
  IMPORT_MAX_ROWS_PER_REQUEST,
} from "@/lib/import/batches";
import { validateEmails } from "@/lib/import/validation";
import { checkContactHeadroom } from "@/lib/plans/guards";
import { nextPlanUp, PLAN_LIMITS } from "@/lib/plans/limits";

export const runtime = "nodejs";

// One request is one chunk of a file (the wizard sends ~1,000 rows at a
// time; see lib/import/batches.ts). Every step is safe to repeat: rows that
// already exist count as duplicates and the insert ignores conflicts, so a
// chunk re-sent after a lost response does not create anything twice.

const LOOKUP_BATCH_SIZE = 1_000;

type Incoming = { email?: unknown; name?: unknown };

/** Existing contacts among `emails`, as email → id. Bounded to this chunk. */
async function existingContactIds(organizationId: string, emails: string[]) {
  const ids = new Map<string, string>();
  for (let index = 0; index < emails.length; index += LOOKUP_BATCH_SIZE) {
    const batch = emails.slice(index, index + LOOKUP_BATCH_SIZE);
    const rows = await db
      .select({ id: recipients.id, email: recipients.email })
      .from(recipients)
      .where(
        and(
          eq(recipients.organizationId, organizationId),
          inArray(recipients.email, batch),
        ),
      );
    for (const row of rows) ids.set(row.email, row.id);
  }
  return ids;
}

/** Adds contacts to a folder; already-filed ones are left as they are. */
async function addToFolder(categoryId: string, recipientIds: string[]) {
  for (let index = 0; index < recipientIds.length; index += LOOKUP_BATCH_SIZE) {
    const batch = recipientIds.slice(index, index + LOOKUP_BATCH_SIZE);
    await db
      .insert(recipientCategories)
      .values(batch.map((recipientId) => ({ recipientId, categoryId })))
      .onConflictDoNothing();
  }
}

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
  if (contacts.length > IMPORT_MAX_ROWS_PER_REQUEST) {
    return NextResponse.json(
      {
        ok: false,
        error: `Send at most ${IMPORT_MAX_ROWS_PER_REQUEST.toLocaleString()} rows per request. The import wizard splits larger files for you.`,
      },
      { status: 413 },
    );
  }

  // Optional folder. Checked against the caller's workspace before anything
  // is written, so a stale or foreign id fails the request cleanly.
  const categoryId =
    typeof body?.categoryId === "string" && body.categoryId ? body.categoryId : null;
  if (categoryId) {
    const [folder] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(eq(categories.id, categoryId), eq(categories.organizationId, organizationId)),
      )
      .limit(1);
    if (!folder) {
      return NextResponse.json(
        { ok: false, error: "That folder no longer exists. Choose another folder and retry." },
        { status: 404 },
      );
    }
  }

  // How many "contact added" automations this chunk may still fire for the
  // whole file (the wizard tracks the running total). Missing means a
  // single-request import, which gets the full cap as before.
  const requestedBudget = Number(body?.automationBudget);
  const automationBudget = Number.isFinite(requestedBudget)
    ? Math.min(Math.max(Math.floor(requestedBudget), 0), IMPORT_AUTOMATION_CAP)
    : IMPORT_AUTOMATION_CAP;

  try {
    // Stage 1 filter: syntax + disposable + role + MX/DNS, deduped by domain.
    // The DNS pass has a time budget (lib/import/validation.ts), so a chunk
    // with thousands of unknown domains cannot outlive the function.
    const { results, report } = await validateEmails(
      contacts.map((row) => String(row.email ?? "")),
    );

    const validEmails = [
      ...new Set(results.filter((r) => r.status === "valid").map((r) => r.email)),
    ];
    const [existing, suppressed] = await Promise.all([
      existingContactIds(organizationId, validEmails),
      listSuppressedSetForOrganization(organizationId),
    ]);

    const seen = new Set<string>();
    const toInsert: { email: string; name: string | null }[] = [];
    // Already-saved contacts from this chunk that belong in the folder too.
    const existingForFolder = new Set<string>();
    let duplicates = 0;
    let suppressedCount = 0;
    let roleFlagged = 0;

    results.forEach((result, index) => {
      // Dropped by the validator (bad syntax, dead domain, disposable) — already
      // tallied in `report`, nothing more to do.
      if (result.status !== "valid") return;

      const email = result.email;
      const existingId = existing.get(email);
      if (seen.has(email) || existingId) {
        duplicates++;
        if (existingId && !suppressed.has(email)) existingForFolder.add(existingId);
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
    // than truncated: a half-imported chunk leaves someone guessing which
    // people made it in, which is worse than importing none of it.
    const headroom = await checkContactHeadroom(organizationId, toInsert.length);
    if (!headroom.ok) {
      return NextResponse.json(
        {
          ok: false,
          error:
            `These rows add ${toInsert.length.toLocaleString()} new contacts, but only ` +
            `${headroom.remaining.toLocaleString()} of your ${headroom.limit.toLocaleString()} ` +
            `contacts are still free, so none of them were imported. ` +
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

    let addedToFolder = 0;
    if (categoryId) {
      const folderIds = [...inserted.map((row) => row.id), ...existingForFolder];
      await addToFolder(categoryId, folderIds);
      addedToFolder = folderIds.length;
    }

    // Fire "contact added" automations for imported contacts, within the
    // file's remaining budget so a huge import can't fan out tens of
    // thousands of welcome emails in one go.
    const automationContacts = inserted.slice(0, automationBudget);
    await enqueueAutomationsForEvent(
      organizationId,
      "contact.added",
      automationContacts.map((recipient) => ({
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
        addedToFolder,
      },
      automationsQueued: automationContacts.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

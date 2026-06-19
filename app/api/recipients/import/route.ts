// Bulk import committed by the import wizard. The browser parses the file and
// maps columns; this endpoint is the authoritative gate — it re-validates every
// address, dedupes within the payload, against the existing list, AND against
// the suppression list (never re-add someone who unsubscribed/bounced), then
// inserts what's left and returns a summary the wizard shows.

import { NextResponse } from "next/server";
import { addRecipientsBulk, listRecipients } from "@/db/recipients";
import { listSuppressedSet } from "@/db/suppression";
import { currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ROWS = 50_000;

type Incoming = { email?: unknown; name?: unknown };

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
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

  // Everything we already know about, so we can categorize each incoming row.
  const [existing, suppressed] = await Promise.all([
    listRecipients(userId),
    listSuppressedSet(userId),
  ]);
  const existingSet = new Set(existing.map((r) => r.email));

  const seen = new Set<string>(); // dedupe within the file itself
  const toInsert: { email: string; name: string | null }[] = [];
  let invalid = 0;
  let duplicates = 0;
  let suppressedCount = 0;

  for (const row of contacts) {
    const email = String(row.email ?? "").trim().toLowerCase();
    const name = String(row.name ?? "").trim() || null;

    if (!EMAIL_RE.test(email)) {
      invalid++;
      continue;
    }
    if (seen.has(email) || existingSet.has(email)) {
      duplicates++;
      continue;
    }
    if (suppressed.has(email)) {
      suppressedCount++;
      continue;
    }
    seen.add(email);
    toInsert.push({ email, name });
  }

  const inserted = await addRecipientsBulk(userId, toInsert);

  return NextResponse.json({
    ok: true,
    summary: {
      received: contacts.length,
      imported: inserted.length,
      duplicates,
      invalid,
      suppressed: suppressedCount,
    },
  });
}

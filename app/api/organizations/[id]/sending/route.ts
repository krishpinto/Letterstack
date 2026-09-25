// The workspace's sender defaults, for Settings → Sending.
//
// PATCH { defaultFromName?, defaultReplyTo? } — owner/admin only.
//
// There is no GET: the panel is handed its state as a server prop from
// app/dashboard/settings/page.tsx, which already loads the organization and
// its domains for the other panels. A GET here would be a second round trip
// for data the page has in hand.

import { NextResponse } from "next/server";

import { getSenderDefaults, updateSenderDefaults } from "@/db/organizations";
import { normalizeEmail } from "@/lib/api/errors";
import { requireManager } from "@/lib/organizations/require-owner";

export const runtime = "nodejs";

/** Long enough for "The Cornerstone Business Alumni Association". */
const MAX_FROM_NAME = 78;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { error } = await requireManager(id);
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Expected a JSON body" }, { status: 400 });
  }

  const rawFromName = typeof body.defaultFromName === "string" ? body.defaultFromName.trim() : "";
  const rawReplyTo = typeof body.defaultReplyTo === "string" ? body.defaultReplyTo.trim() : "";

  if (rawFromName.length > MAX_FROM_NAME) {
    return NextResponse.json(
      { ok: false, error: `Keep the From name under ${MAX_FROM_NAME} characters.` },
      { status: 400 },
    );
  }

  // A From name is what recipients see in their inbox list, so the two
  // characters that would let it impersonate a header get refused outright.
  // Nothing downstream is injectable — SESv2 takes the name as a structured
  // field, not a raw header line — but a newline in a display name has no
  // legitimate use, and refusing it here means no compiler or transport
  // change can ever make it one.
  if (/[\r\n]/.test(rawFromName)) {
    return NextResponse.json(
      { ok: false, error: "The From name can't contain line breaks." },
      { status: 400 },
    );
  }

  // Cleared is allowed; malformed is not. An empty string means "no default",
  // which is a legitimate thing to want back.
  let defaultReplyTo: string | null = null;
  if (rawReplyTo) {
    defaultReplyTo = normalizeEmail(rawReplyTo);
    if (!defaultReplyTo) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid reply-to address, or leave it empty." },
        { status: 400 },
      );
    }
  }

  const defaults = await updateSenderDefaults(id, {
    defaultFromName: rawFromName || null,
    defaultReplyTo,
  });

  return NextResponse.json({ ok: true, defaults });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { error } = await requireManager(id);
  if (error) return error;
  return NextResponse.json({ ok: true, defaults: await getSenderDefaults(id) });
}

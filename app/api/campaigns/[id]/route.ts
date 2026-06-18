// GET   — one campaign (incl. its editable document) for the send page.
// PATCH — save a draft's design back: recompiles + freezes the snapshot.
//         This is the endpoint the editor should call to persist "Edit design".

import { NextResponse } from "next/server";
import { compileEmailDocument } from "@/lib/email/compiler";
import { isEmailDocument, normalizeDocument } from "@/lib/email/document";
import { getCampaignForUser, updateCampaignDraft } from "@/db/campaigns";
import { currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const campaign = await getCampaignForUser(id, userId);
  if (!campaign) {
    return NextResponse.json({ ok: false, error: "Campaign not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, campaign });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);
    if (!isEmailDocument(body?.document)) {
      return NextResponse.json({ ok: false, error: "Valid document required" }, { status: 400 });
    }
    const doc = normalizeDocument(body.document);
    const { html, text } = compileEmailDocument(doc);

    const updated = await updateCampaignDraft(id, userId, {
      name: typeof body?.name === "string" ? body.name : doc.name,
      subject: typeof body?.subject === "string" ? body.subject : doc.subject,
      fromName: typeof body?.fromName === "string" ? body.fromName : doc.fromName,
      fromEmail: typeof body?.fromEmail === "string" ? body.fromEmail : doc.fromEmail,
      html,
      text,
      document: doc,
    });

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Campaign not found or already sent" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, campaign: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

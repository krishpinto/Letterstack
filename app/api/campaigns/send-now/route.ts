// Create a campaign from the email composed in the editor and start sending it.
// The browser sends the editor's current document (read from localStorage); we
// compile + freeze it into a campaign. Falls back to the sample if none given.

import { NextResponse } from "next/server";
import { compileEmailDocument } from "@/lib/email/compiler";
import { initialEmailDocument, isEmailDocument, normalizeDocument } from "@/lib/email/document";
import { createCampaign } from "@/db/campaigns";
import { startCampaign } from "@/lib/send/send-campaign";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const fromEmail = process.env.MAIL_FROM;
  if (!fromEmail) {
    return NextResponse.json({ ok: false, error: "MAIL_FROM missing" }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => null);
    const raw = body?.document;
    // Use the editor's document if it's valid; otherwise the sample.
    const doc = isEmailDocument(raw) ? normalizeDocument(raw) : initialEmailDocument;

    // Subject + from-name typed on the send page win over the document's.
    const subject =
      typeof body?.subject === "string" && body.subject.trim()
        ? body.subject.trim()
        : doc.subject || "Newsletter";
    const fromName =
      typeof body?.fromName === "string" && body.fromName.trim()
        ? body.fromName.trim()
        : doc.fromName || "LetterStack";

    const { html, text } = compileEmailDocument(doc);
    const campaign = await createCampaign({
      name: doc.name || "Untitled campaign",
      subject,
      fromName,
      fromEmail, // always the verified sender, whatever the editor set
      html,
      text,
    });

    const result = await startCampaign(campaign.id);
    return NextResponse.json({ ok: true, id: campaign.id, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

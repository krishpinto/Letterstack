// Create a campaign from the current email and immediately start sending it.
// Returns the new campaign id so the UI can jump to the live monitor.
// (Content is the sample doc for now; the editor → campaign seam is a later step.)

import { NextResponse } from "next/server";
import { compileEmailDocument } from "@/lib/email/compiler";
import { initialEmailDocument } from "@/lib/email/document";
import { createCampaign } from "@/db/campaigns";
import { startCampaign } from "@/lib/send/send-campaign";

export const runtime = "nodejs";

export async function POST() {
  const fromEmail = process.env.MAIL_FROM;
  if (!fromEmail) {
    return NextResponse.json({ ok: false, error: "MAIL_FROM missing" }, { status: 400 });
  }

  try {
    const doc = {
      ...initialEmailDocument,
      name: `Campaign ${new Date().toLocaleString()}`,
      subject: "LetterStack newsletter",
      fromName: "LetterStack",
      fromEmail,
    };

    // Freeze the content into a campaign, then fire the send.
    const { html, text } = compileEmailDocument(doc);
    const campaign = await createCampaign({
      name: doc.name,
      subject: doc.subject,
      fromName: doc.fromName,
      fromEmail,
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

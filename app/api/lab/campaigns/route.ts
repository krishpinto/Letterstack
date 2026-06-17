// Lab endpoint for campaigns. POST compiles the sample email and freezes it
// into a draft campaign; GET lists campaigns.

import { NextResponse } from "next/server";
import { compileEmailDocument } from "@/lib/email/compiler";
import { initialEmailDocument } from "@/lib/email/document";
import { createCampaign, listCampaigns } from "@/db/campaigns";

export const runtime = "nodejs";

export async function GET() {
  try {
    const campaigns = await listCampaigns();
    return NextResponse.json({ ok: true, campaigns });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST() {
  const fromEmail = process.env.MAIL_FROM;
  if (!fromEmail) {
    return NextResponse.json({ ok: false, error: "MAIL_FROM missing" }, { status: 400 });
  }

  try {
    // The content comes from the sample doc for now (later: the editor).
    const doc = {
      ...initialEmailDocument,
      name: "Sample campaign",
      subject: "LetterStack — sample campaign",
      fromName: "LetterStack",
      fromEmail,
    };
    // Compile ONCE here, then freeze the result into the campaign.
    const { html, text } = compileEmailDocument(doc);
    const campaign = await createCampaign({
      name: doc.name,
      subject: doc.subject,
      fromName: doc.fromName,
      fromEmail,
      html,
      text,
    });

    return NextResponse.json({ ok: true, campaign });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

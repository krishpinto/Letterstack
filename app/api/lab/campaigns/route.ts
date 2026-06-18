// Lab endpoint for campaigns. POST compiles the sample email and freezes it
// into a draft campaign; GET lists campaigns.

import { NextResponse } from "next/server";
import { compileEmailDocument } from "@/lib/email/compiler";
import { initialEmailDocument } from "@/lib/email/document";
import { createCampaign, listCampaigns } from "@/db/campaigns";
import { currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const campaigns = await listCampaigns(userId);
    return NextResponse.json({ ok: true, campaigns });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST() {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
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
    const campaign = await createCampaign(userId, {
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

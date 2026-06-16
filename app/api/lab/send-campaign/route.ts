// Runs a campaign send to EVERYONE in the recipients table.
// It builds a sample newsletter, then calls the real sendCampaignToAll().

import { NextResponse } from "next/server";
import { initialEmailDocument } from "@/lib/email/document";
import { sendCampaignToAll } from "@/lib/send/send-campaign";

export const runtime = "nodejs";

export async function POST() {
  const fromEmail = process.env.MAIL_FROM;
  if (!fromEmail) {
    return NextResponse.json(
      { ok: false, error: "MAIL_FROM is missing in .env.local" },
      { status: 400 },
    );
  }

  try {
    const doc = {
      ...initialEmailDocument,
      subject: "LetterStack — campaign to the whole list ✔",
      fromName: "LetterStack",
      fromEmail,
    };

    const summary = await sendCampaignToAll(doc);
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

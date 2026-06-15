// A tiny SERVER endpoint (a Next.js "API route").
//
// The /lab page's button calls this URL. This code runs on the SERVER — where
// the secret AWS keys live — never in the browser. Its whole job: hand one
// compiled email to SES via our sendEmail() function and report back the result.
//
// Why this exists at all: the browser is public, so secrets can't live there.
// The button (browser) asks; this endpoint (server) does the secret work.

import { NextResponse } from "next/server";
import { compileEmailDocument } from "@/lib/email/compiler";
import { initialEmailDocument } from "@/lib/email/document";
import { sendEmail } from "@/lib/send/ses";

// The AWS SDK needs the full Node.js runtime (not Vercel's lighter "edge"
// runtime), so we ask Next.js for Node explicitly.
export const runtime = "nodejs";

// "POST" = this endpoint does an action (sending), as opposed to just reading.
// The browser will fetch("/api/lab/send-test", { method: "POST" }).
export async function POST() {
  const to = process.env.TEST_TO;
  const fromEmail = process.env.MAIL_FROM;

  // If the env isn't filled in yet, say so clearly so the page can show why
  // instead of throwing a confusing AWS error.
  if (!to || !fromEmail) {
    return NextResponse.json(
      { ok: false, error: "TEST_TO or MAIL_FROM is missing in .env.local" },
      { status: 400 },
    );
  }

  try {
    // Start from the editor's default newsletter, override the send fields.
    const doc = {
      ...initialEmailDocument,
      subject: "LetterStack — /lab test send ✔",
      fromName: "LetterStack",
      fromEmail,
    };

    // The seam with the editor: turn the document into email-ready HTML + text.
    const { html, text } = compileEmailDocument(doc);

    // Hand it to the courier. Returns SES's MessageId if accepted.
    const messageId = await sendEmail({
      to,
      subject: doc.subject,
      html,
      text,
      fromName: doc.fromName,
      fromEmail,
    });

    return NextResponse.json({ ok: true, messageId, to, fromEmail });
  } catch (err) {
    // SES problems (unverified address, bad keys, wrong region) land here.
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

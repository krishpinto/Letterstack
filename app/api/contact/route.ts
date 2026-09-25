// Public contact-form endpoint. The landing page's "Contact us" screen posts
// here; the message is relayed to the operator's inbox through SES with the
// visitor's address as Reply-To, so answering is just hitting reply.
//
// The destination is CONTACT_INBOX rather than a constant, so a self-hosted
// deployment delivers to its own operator instead of this project's authors.
// Unset, the form reports that contact is unavailable rather than sending
// somewhere unintended.

import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/send/ses";

export const runtime = "nodejs";

const CONTACT_INBOX = process.env.CONTACT_INBOX;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE_LENGTH = 4000;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function POST(request: Request) {
  const fromEmail = process.env.MAIL_FROM;
  if (!fromEmail || !CONTACT_INBOX) {
    return NextResponse.json(
      { ok: false, error: "Contact form is not configured." },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const companySize =
    typeof body?.companySize === "string" ? body.companySize.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (name.length < 2) {
    return NextResponse.json(
      { ok: false, error: "Please tell us your name." },
      { status: 400 },
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid email address." },
      { status: 400 },
    );
  }
  if (!message) {
    return NextResponse.json(
      { ok: false, error: "Tell us a little about what you need." },
      { status: 400 },
    );
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { ok: false, error: "Message is too long." },
      { status: 400 },
    );
  }

  const lines = [
    `Name: ${name}`,
    `Email: ${email}`,
    companySize ? `Company size: ${companySize}` : null,
    "",
    message,
  ].filter((line): line is string => line !== null);

  try {
    await sendEmail({
      to: CONTACT_INBOX,
      subject: `LetterStack contact — ${name}`,
      text: lines.join("\n"),
      html: `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(
        lines.join("\n"),
      )}</pre>`,
      fromName: "LetterStack Contact",
      fromEmail,
      replyTo: email,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    console.error("Contact form send failed:", detail);
    return NextResponse.json(
      { ok: false, error: "Could not send your message. Please try again." },
      { status: 500 },
    );
  }
}

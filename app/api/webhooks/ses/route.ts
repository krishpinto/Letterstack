// The SES events webhook. In production: SES → SNS → here.
//
// It records every event in email_events, and the moment SES reports a Bounce
// or Complaint, it drops that address onto the suppression list automatically —
// so bad addresses remove themselves, which is what keeps SES from suspending
// you. (SNS signature verification is a deploy-time TODO, like QStash's was.)

import { NextResponse } from "next/server";
import { recordEvent } from "@/db/events";
import { suppressEmail } from "@/db/suppression";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  if (!raw) {
    return NextResponse.json({ ok: false, error: "Bad payload" }, { status: 400 });
  }

  // SNS sends a one-time confirmation when you first subscribe. We confirm it
  // automatically by fetching the SubscribeURL SNS provides — then the
  // subscription goes active and real events start flowing.
  if (raw.Type === "SubscriptionConfirmation") {
    if (raw.SubscribeURL) await fetch(raw.SubscribeURL).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  // Real SNS wraps the SES event as a JSON string in `Message`. Our local
  // simulation posts the event directly. Handle both.
  const event = typeof raw.Message === "string" ? JSON.parse(raw.Message) : raw;

  // SES uses `eventType` (config sets) or `notificationType` (legacy).
  const type: string = event.eventType ?? event.notificationType ?? "Unknown";

  // Pull the affected address out of whichever sub-object applies.
  const email: string | null =
    event.bounce?.bouncedRecipients?.[0]?.emailAddress ??
    event.complaint?.complainedRecipients?.[0]?.emailAddress ??
    event.mail?.destination?.[0] ??
    null;

  if (email) {
    await recordEvent(email, type);
    // Hard bounces and complaints are permanent — never email them again.
    if (type === "Bounce" || type === "Complaint") {
      await suppressEmail(email, type.toLowerCase());
    }
  }

  return NextResponse.json({ ok: true });
}

// The WORKER endpoint — QStash calls this once per batch.
//
// QStash is "dumb": it re-delivers the batch it was given (and retries on
// failure). This endpoint is the "smart" one: before sending, it re-checks the
// sent-checklist (listUnsentByIds), so a retried batch skips anyone already
// emailed.
//
// SECURITY (2c): this URL is public once deployed, so we verify QStash's
// signature first. Every request QStash makes is signed with our signing keys;
// a request without a valid signature (a random attacker) is rejected with 401.

import { NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { listUnsentByIds } from "@/db/recipients";
import { sendBatch, type FrozenContent } from "@/lib/send/send-campaign";

export const runtime = "nodejs";

// The "bouncer" — it knows our signing keys and can tell a genuine QStash
// request from a forged one.
const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

export async function POST(request: Request) {
  // Read the RAW body (as text) — the signature is computed over these exact
  // bytes, so we must verify before parsing.
  const body = await request.text();
  const signature = request.headers.get("upstash-signature") ?? "";

  // Is this really from QStash? .catch(() => false) treats any failure as invalid.
  const isValid = await receiver.verify({ body, signature }).catch(() => false);
  if (!isValid) {
    return NextResponse.json(
      { ok: false, error: "Invalid or missing QStash signature" },
      { status: 401 },
    );
  }

  try {
    const { content, userId, recipientIds } = JSON.parse(body) as {
      content: FrozenContent;
      userId: string;
      recipientIds: string[];
    };

    // Only the people in this batch who are STILL unsent (retry-safe).
    const people = await listUnsentByIds(recipientIds ?? []);
    const result = await sendBatch(content, people, userId);

    console.log(
      `worker: batch done — sent ${result.sent}, suppressed ${result.suppressed}, ` +
        `failed ${result.failed}, skipped ${
          (recipientIds?.length ?? 0) - people.length
        } (already sent)`,
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    // A non-200 tells QStash to retry later (safe, thanks to the recheck).
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

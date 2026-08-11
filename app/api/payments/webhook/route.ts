// Razorpay webhook — the authoritative settlement path.
//
// The browser callback in /api/payments/verify is best-effort: if the payer
// closes the tab, loses signal, or the page errors after the charge goes
// through, it never fires and the money is taken with nothing recorded.
// Razorpay calls this endpoint server-to-server and retries until it gets a
// 2xx, so this is what actually guarantees a captured payment gets recorded.
//
// Configure it in the Razorpay dashboard (Settings → Webhooks) against
// <APP_URL>/api/payments/webhook, subscribed to payment.captured and
// payment.failed, and put the signing secret in RAZORPAY_WEBHOOK_SECRET.

import { NextResponse } from "next/server";
import { getPaymentByOrderIdUnscoped, markPaymentFailed } from "@/db/payments";
import { isValidWebhookSignature } from "@/lib/payments/razorpay";
import { settlePaidOrder } from "@/lib/payments/settle";

export const runtime = "nodejs";

type RazorpayWebhookEvent = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number;
        currency?: string;
      };
    };
  };
};

export async function POST(request: Request) {
  // Must be the raw text: the signature covers the exact bytes sent, so
  // parsing and re-serialising would change what we're verifying.
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  let valid: boolean;
  try {
    valid = isValidWebhookSignature(rawBody, signature);
  } catch (err) {
    // Missing secret — a config problem on our side, not a bad caller. 500
    // so Razorpay retries once it's fixed rather than dropping the event.
    console.error("Razorpay webhook not configured", err);
    return NextResponse.json(
      { ok: false, error: "Webhook not configured" },
      { status: 500 },
    );
  }

  if (!valid) {
    return NextResponse.json(
      { ok: false, error: "Invalid signature" },
      { status: 401 },
    );
  }

  let event: RazorpayWebhookEvent;
  try {
    event = JSON.parse(rawBody) as RazorpayWebhookEvent;
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed body" }, { status: 400 });
  }

  const entity = event.payload?.payment?.entity;
  const orderId = entity?.order_id;
  const paymentId = entity?.id;

  // Anything we don't handle is still a success as far as Razorpay is
  // concerned — returning non-2xx would make it retry an event forever.
  if (!orderId || !paymentId) {
    return NextResponse.json({ ok: true, ignored: event.event ?? "unknown" });
  }

  const existing = await getPaymentByOrderIdUnscoped(orderId);
  if (!existing) {
    console.warn("Razorpay webhook for an order we have no record of", orderId);
    return NextResponse.json({ ok: true, ignored: "unknown-order" });
  }

  switch (event.event) {
    case "payment.captured": {
      // Guard against a captured amount that doesn't match what we charged
      // for. Refuse to settle rather than record a payment we can't explain.
      if (
        typeof entity.amount === "number" &&
        entity.amount !== existing.amount
      ) {
        console.error(
          `Razorpay webhook amount mismatch on ${orderId}: charged ${existing.amount}, captured ${entity.amount}`,
        );
        return NextResponse.json({ ok: true, ignored: "amount-mismatch" });
      }

      const result = await settlePaidOrder(orderId, paymentId);
      // settled:false means another caller (the browser callback, or a retry
      // of this event) got there first — the normal case, not an error.
      return NextResponse.json({ ok: true, ...result });
    }

    case "payment.failed": {
      await markPaymentFailed(orderId, paymentId);
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ ok: true, ignored: event.event ?? "unknown" });
  }
}

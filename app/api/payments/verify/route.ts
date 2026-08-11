// Verifies a completed Razorpay checkout.
//
// POST { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// A payment is only ever marked paid here, after the HMAC signature checks
// out against our key secret. A mismatch marks the attempt failed and
// returns 400 — the caller's claim of success is not evidence of one.

import { type NextRequest, NextResponse } from "next/server";
import { getPaymentByOrderId, markPaymentFailed } from "@/db/payments";
import { settlePaidOrder } from "@/lib/payments/settle";
import { currentOrganizationId, currentUserId } from "@/lib/auth-helpers";
import { isValidPaymentSignature } from "@/lib/payments/razorpay";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return NextResponse.json(
      { ok: false, error: "Organization required" },
      { status: 428 },
    );
  }

  const body = await request.json().catch(() => null);
  const orderId = String(body?.razorpay_order_id ?? "").trim();
  const paymentId = String(body?.razorpay_payment_id ?? "").trim();
  const signature = String(body?.razorpay_signature ?? "").trim();

  if (!orderId || !paymentId || !signature) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "razorpay_order_id, razorpay_payment_id and razorpay_signature are all required.",
      },
      { status: 400 },
    );
  }

  const existing = await getPaymentByOrderId(organizationId, orderId);
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "Unknown order for this workspace." },
      { status: 404 },
    );
  }

  if (!isValidPaymentSignature({ orderId, paymentId, signature })) {
    await markPaymentFailed(orderId, paymentId);
    return NextResponse.json(
      { ok: false, error: "Payment signature did not verify." },
      { status: 400 },
    );
  }

  // The webhook may well have settled this already — that's the expected
  // race, not an error. settlePaymentPaid returns null when someone else got
  // there first, and either way the payer sees the same success.
  const result = await settlePaidOrder(orderId, paymentId);
  return NextResponse.json({
    ok: true,
    status: "paid",
    alreadySettled: !result.settled,
    planGranted: result.planGranted,
    payment: { amount: existing.amount, currency: existing.currency },
  });
}

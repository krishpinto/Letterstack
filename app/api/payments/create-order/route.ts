// Creates a Razorpay order for the active organization.
//
// POST { item } — a key from lib/payments/catalog.ts. The amount comes from
// that catalog, never from the request: the browser picks what it's buying,
// the server decides what it costs. Returns the order id the checkout widget
// needs. Nothing counts as paid until a signature verifies, in
// /api/payments/verify or /api/payments/webhook.

import { type NextRequest, NextResponse } from "next/server";
import { getOrganizationForUser } from "@/db/organizations";
import { recordOrder } from "@/db/payments";
import { isAdmin } from "@/lib/admin";
import { auth } from "@/lib/auth";
import { currentOrganizationId } from "@/lib/auth-helpers";
import { getPaymentItem, itemDisplayName } from "@/lib/payments/catalog";
import { createOrder } from "@/lib/payments/razorpay";

export const runtime = "nodejs";

// Same shape as the public subscribe endpoint's limiter: per-process, good
// enough at this scale to stop a runaway client hammering Razorpay's API.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > RATE_MAX;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
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
  const organization = await getOrganizationForUser(userId, organizationId);
  if (!organization) {
    return NextResponse.json(
      { ok: false, error: "Organization not found" },
      { status: 404 },
    );
  }

  if (rateLimited(userId)) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts — try again shortly." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const itemKey = String(body?.item ?? "");
  const item = getPaymentItem(itemKey);
  if (!item) {
    return NextResponse.json(
      { ok: false, error: "Unknown item." },
      { status: 400 },
    );
  }
  if (item.adminOnly && !isAdmin(session?.user?.email)) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  // Razorpay caps receipts at 40 characters.
  const receipt = `ls_${Date.now()}_${organization.id.slice(0, 8)}`;

  try {
    const order = await createOrder({
      amount: item.amount,
      currency: item.currency,
      receipt,
      notes: { organizationId: organization.id, userId, item: itemKey },
    });
    await recordOrder({
      organizationId: organization.id,
      userId,
      razorpayOrderId: order.id,
      item: itemKey,
      amount: item.amount,
      currency: item.currency,
      receipt,
    });

    return NextResponse.json({
      ok: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      description: itemDisplayName(itemKey),
    });
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode;
    if (status === 401) {
      console.error("Razorpay rejected our API credentials", err);
      return NextResponse.json(
        { ok: false, error: "Payment provider credentials are invalid." },
        { status: 401 },
      );
    }
    console.error("POST /api/payments/create-order failed", err);
    return NextResponse.json(
      { ok: false, error: "Could not start checkout. Please try again." },
      { status: 500 },
    );
  }
}

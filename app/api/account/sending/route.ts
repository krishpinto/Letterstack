// The account's branded sending identity (subdomain slug).
// GET  → current slug + the base domain + the resulting From address.
// PUT  → set/change the slug (validated).

import { NextResponse } from "next/server";
import { getSendingSlug, setSendingSlug } from "@/db/users";
import {
  baseSendingDomain,
  isValidSlug,
  sendingAddressForSlug,
} from "@/lib/send/sender-identity";
import { currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const slug = await getSendingSlug(userId);
  return NextResponse.json({
    ok: true,
    slug,
    baseDomain: baseSendingDomain(),
    address: sendingAddressForSlug(slug),
  });
}

export async function PUT(request: Request) {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug.trim().toLowerCase() : "";
  if (slug !== "" && !isValidSlug(slug)) {
    return NextResponse.json(
      { ok: false, error: "Use lowercase letters, numbers and hyphens (e.g. ciba)." },
      { status: 400 },
    );
  }
  await setSendingSlug(userId, slug);
  return NextResponse.json({
    ok: true,
    slug,
    baseDomain: baseSendingDomain(),
    address: sendingAddressForSlug(slug),
  });
}

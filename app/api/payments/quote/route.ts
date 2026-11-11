// GET ?plan=growth — what buying that tier would do to the active workspace,
// for the billing panel to say before anyone pays: the new end date, any
// days converted from unused time, or why it can't be bought right now.
//
// Read-only. The same rule runs again at create-order and at settlement, so
// this is a preview, never a promise the server has to honour.

import { type NextRequest, NextResponse } from "next/server";

import { getOrganizationForUser } from "@/db/organizations";
import { currentOrganizationId, currentUserId } from "@/lib/auth-helpers";
import { checkoutItemsFor } from "@/lib/payments/catalog";
import { quoteItemForOrganization } from "@/lib/payments/quote";
import { isPlanKey } from "@/lib/plans/limits";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
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
  const organization = await getOrganizationForUser(userId, organizationId);
  if (!organization) {
    return NextResponse.json(
      { ok: false, error: "Organization not found" },
      { status: 404 },
    );
  }

  const plan = request.nextUrl.searchParams.get("plan");
  const items = isPlanKey(plan) ? checkoutItemsFor(plan) : null;
  if (!items) {
    return NextResponse.json({ ok: false, error: "Unknown plan." }, { status: 400 });
  }

  const now = new Date();
  const [monthly, yearly] = await Promise.all([
    quoteItemForOrganization(organization, items.monthly, now),
    quoteItemForOrganization(organization, items.yearly, now),
  ]);

  return NextResponse.json({ ok: true, monthly, yearly });
}

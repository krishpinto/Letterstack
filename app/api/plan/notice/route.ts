// Dismissal for the "you've got Pro free for 2 months" announcement.
//
// Write-only and idempotent: the dialog fires this once when it closes, and
// a repeat call from a double-click or a retried request just rewrites the
// same flag. There is no un-dismiss — see markPlanNoticeSeen.

import { NextResponse } from "next/server";

import { markPlanNoticeSeen } from "@/db/users";
import { currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

export async function POST() {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  await markPlanNoticeSeen(userId);
  return NextResponse.json({ ok: true });
}

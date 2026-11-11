import { NextResponse } from "next/server";
import { labGuard } from "@/lib/lab/dev-only";

export const runtime = "nodejs";

export async function POST() {
  const blocked = labGuard();
  if (blocked) return blocked;
  return NextResponse.json(
    {
      ok: false,
      error:
        "Global-recipient sends are deprecated. Create a campaign audience and use /api/campaigns/[id]/send.",
    },
    { status: 410 },
  );
}

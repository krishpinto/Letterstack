import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Immediate global sends are deprecated. Create a campaign, add its audience, then use /api/campaigns/[id]/send.",
    },
    { status: 410 },
  );
}

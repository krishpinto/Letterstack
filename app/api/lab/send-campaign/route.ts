import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Global-recipient sends are deprecated. Create a campaign audience and use /api/campaigns/[id]/send.",
    },
    { status: 410 },
  );
}

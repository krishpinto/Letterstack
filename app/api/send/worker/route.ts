import { NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";

export const runtime = "nodejs";

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("upstash-signature") ?? "";

  const isValid = await receiver.verify({ body, signature }).catch(() => false);
  if (!isValid) {
    return NextResponse.json(
      { ok: false, error: "Invalid or missing QStash signature" },
      { status: 401 },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error:
        "Global-recipient workers are deprecated. Campaign sends must use /api/send/campaign-worker.",
    },
    { status: 410 },
  );
}

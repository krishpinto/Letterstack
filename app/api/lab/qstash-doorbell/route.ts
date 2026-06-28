import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Ring = { at: string; payload: unknown };

const store = globalThis as unknown as { __qstashRing?: Ring };

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  store.__qstashRing = { at: new Date().toISOString(), payload };
  console.log("QStash doorbell payload:", payload);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, ring: store.__qstashRing ?? null });
}

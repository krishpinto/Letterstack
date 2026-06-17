// The trigger. The /lab button calls this; it uses the QStash "phone" to hand
// QStash one job: "please POST this payload to my doorbell endpoint."
//
// (The browser can't call QStash directly — the token is a server secret — so
// this server endpoint does it. Same client/server split as every other button.)

import { NextResponse } from "next/server";
import { qstash } from "@/lib/send/qstash";

export const runtime = "nodejs";

export async function POST() {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  try {
    const result = await qstash.publishJSON({
      // The URL QStash will call back (ring). Must be reachable from QStash —
      // locally that's your Next server; in prod it'd be your Vercel URL.
      url: `${appUrl}/api/lab/qstash-doorbell`,
      // Whatever we put here is what QStash delivers to the doorbell.
      body: { hello: "from the trigger", firedAt: new Date().toISOString() },
    });

    return NextResponse.json({ ok: true, messageId: result.messageId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

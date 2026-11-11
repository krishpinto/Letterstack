// QStash-delivered endpoint that executes automation flow steps for one
// contact. Enqueued by trigger hooks (contact added / unsubscribed) and by
// Delay nodes (delayed continuation). Signature-verified like the campaign
// worker; the engine itself re-checks the automation is still enabled, so
// stale messages for disabled/edited automations no-op.
//
// A 500 makes QStash redeliver the same message, which restarts the walk at
// the same node. That is safe: send and delay steps are claimed per run (see
// lib/automations/steps.ts), so a replay skips the ones already done.

import { NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import {
  runAutomationFromNode,
  type AutomationWorkerPayload,
} from "@/lib/automations/run";
import { legacyRunId } from "@/lib/automations/steps";

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

  try {
    const payload = JSON.parse(body) as AutomationWorkerPayload;
    if (!payload?.automationId || !payload?.nodeId || !payload?.contact?.email) {
      return NextResponse.json({ ok: false, error: "Bad payload" }, { status: 400 });
    }

    // Messages queued before run ids existed carry none. QStash keeps a
    // message's id across retries, so it stands in for one.
    const runId =
      payload.runId || legacyRunId(request.headers.get("upstash-message-id"));
    const trace = await runAutomationFromNode({ ...payload, runId });
    console.log(
      `automation-worker: ${payload.automationId} for ${payload.contact.email} — ${trace.join("; ")}`,
    );
    return NextResponse.json({ ok: true, trace });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

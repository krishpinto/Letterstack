import { NextResponse } from "next/server";
import {
  createAutomation,
  listAutomationsForOrganization,
} from "@/db/automations";
import { createDefaultFlow } from "@/lib/automations/flow";
import { currentOrganizationId, currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

export async function GET() {
  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const automations = await listAutomationsForOrganization(organizationId);
    return NextResponse.json({ ok: true, automations });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  const organizationId = await currentOrganizationId();
  if (!userId || !organizationId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => null)) as { name?: string } | null;
    const name = String(body?.name ?? "").trim() || "Untitled automation";

    const automation = await createAutomation(
      organizationId,
      userId,
      name,
      createDefaultFlow(),
    );
    return NextResponse.json({ ok: true, automation });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

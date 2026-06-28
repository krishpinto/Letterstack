import { NextResponse } from "next/server";
import {
  listSuppressedEmailsForOrganization,
  suppressEmailForOrganization,
} from "@/db/suppression";
import { currentOrganizationId, currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Organization required" }, { status: 428 });
  }

  try {
    const suppressed = await listSuppressedEmailsForOrganization(organizationId);
    return NextResponse.json({ ok: true, suppressed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Organization required" }, { status: 428 });
  }

  try {
    const body = await request.json().catch(() => null);
    const email = String(body?.email ?? "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ ok: false, error: "Email is required" }, { status: 400 });
    }

    await suppressEmailForOrganization(organizationId, userId, email, "manual");
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
// Signup forms for the active organization.
//
// GET  — all forms + the base URL for building embed/hosted links
// POST { name?, ...settings } — create a form (returns it)

import { NextResponse } from "next/server";
import { currentOrganizationId, currentUserId } from "@/lib/auth-helpers";
import {
  createSignupForm,
  listSignupForms,
  type SignupFormSettings,
} from "@/db/signup-forms";
import { appBaseUrl } from "@/lib/send/qstash";

export const runtime = "nodejs";

async function requireOrg() {
  const userId = await currentUserId();
  if (!userId) {
    return { error: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }
  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return {
      error: NextResponse.json(
        { ok: false, error: "Organization required" },
        { status: 428 },
      ),
    };
  }
  return { userId, organizationId };
}

export async function GET() {
  const { organizationId, error } = await requireOrg();
  if (error) return error;

  const forms = await listSignupForms(organizationId);
  return NextResponse.json({ ok: true, baseUrl: appBaseUrl(), forms });
}

export async function POST(request: Request) {
  const { organizationId, userId, error } = await requireOrg();
  if (error) return error;

  const body = (await request.json().catch(() => null)) as
    | (Partial<SignupFormSettings> & { name?: string })
    | null;

  const name = String(body?.name ?? "").trim() || "Untitled form";

  const form = await createSignupForm(organizationId, userId, {
    ...body,
    name,
  });

  return NextResponse.json({ ok: true, baseUrl: appBaseUrl(), form });
}

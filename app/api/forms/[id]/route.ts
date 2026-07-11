// A single signup form.
//
// GET    — the form
// PATCH  { ...settings } — update wording/colors/name (partial)
// DELETE — remove it (kills its hosted page + embed immediately)

import { NextResponse } from "next/server";
import { currentOrganizationId, currentUserId } from "@/lib/auth-helpers";
import {
  deleteSignupForm,
  getSignupForm,
  updateSignupForm,
  type SignupFormSettings,
} from "@/db/signup-forms";

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
  return { organizationId };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { organizationId, error } = await requireOrg();
  if (error) return error;

  const { id } = await params;
  const form = await getSignupForm(organizationId, id);
  if (!form) {
    return NextResponse.json({ ok: false, error: "Form not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, form });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { organizationId, error } = await requireOrg();
  if (error) return error;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Partial<SignupFormSettings> | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const form = await updateSignupForm(organizationId, id, body);
  if (!form) {
    return NextResponse.json({ ok: false, error: "Form not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, form });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { organizationId, error } = await requireOrg();
  if (error) return error;

  const { id } = await params;
  const removed = await deleteSignupForm(organizationId, id);
  if (!removed) {
    return NextResponse.json({ ok: false, error: "Form not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

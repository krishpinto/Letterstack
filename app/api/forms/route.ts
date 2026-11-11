// Signup forms for the active organization.
//
// GET  — all forms + the base URL for building embed/hosted links
// POST { name?, ...settings } — create a form (returns it), within the plan's
//      signup-form allowance (lib/forms/limits.ts)

import { NextResponse } from "next/server";
import { currentOrganizationId, currentUserId } from "@/lib/auth-helpers";
import {
  countSignupForms,
  createSignupForm,
  listSignupForms,
  type SignupFormSettings,
} from "@/db/signup-forms";
import { activePlan, getOrganizationForUser } from "@/db/organizations";
import { signupFormLimitProblem } from "@/lib/forms/limits";
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

  // Count-then-insert, not one guarded statement: a double-click can at
  // worst create one extra form, which costs nothing. The limit is about
  // what each tier offers, not a money barrier like sending.
  const organization = await getOrganizationForUser(userId, organizationId);
  if (!organization) {
    return NextResponse.json({ ok: false, error: "Organization required" }, { status: 428 });
  }
  const problem = signupFormLimitProblem(
    activePlan(organization),
    await countSignupForms(organizationId),
  );
  if (problem) {
    return NextResponse.json({ ok: false, error: problem }, { status: 402 });
  }

  const form = await createSignupForm(organizationId, userId, {
    ...body,
    name,
  });

  return NextResponse.json({ ok: true, baseUrl: appBaseUrl(), form });
}

// POST   — enable sharing for a saved template: returns its (new or existing)
//          share token, used to build the public /templates/shared/<token> link.
// DELETE — revoke sharing: the old link stops working immediately.

import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { emailTemplates } from "@/db/schema";
import { currentOrganizationId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

async function templateForOrg(id: string, organizationId: string) {
  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(
      and(
        eq(emailTemplates.id, id),
        eq(emailTemplates.organizationId, organizationId),
      ),
    );
  return template ?? null;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const template = await templateForOrg(id, organizationId);
    if (!template) {
      return NextResponse.json({ ok: false, error: "Template not found" }, { status: 404 });
    }

    let shareToken = template.shareToken;
    if (!shareToken) {
      shareToken = randomBytes(18).toString("base64url");
      await db
        .update(emailTemplates)
        .set({ shareToken })
        .where(eq(emailTemplates.id, id));
    }

    return NextResponse.json({ ok: true, shareToken });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const template = await templateForOrg(id, organizationId);
    if (!template) {
      return NextResponse.json({ ok: false, error: "Template not found" }, { status: 404 });
    }

    await db
      .update(emailTemplates)
      .set({ shareToken: null })
      .where(eq(emailTemplates.id, id));

    return NextResponse.json({ ok: true, shareToken: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

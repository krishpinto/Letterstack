import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { uniqueTemplateName } from "@/db/email-templates";
import { emailTemplates } from "@/db/schema";
import { currentOrganizationId } from "@/lib/auth-helpers";
import type { EmailDocument } from "@/lib/email/document";

export const runtime = "nodejs";

type TemplateBody = {
  name?: unknown;
  document?: EmailDocument;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [template] = await db
      .select()
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.id, id),
          eq(emailTemplates.organizationId, organizationId),
        ),
      );

    if (!template) {
      return NextResponse.json({ ok: false, error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, template });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => null)) as TemplateBody | null;
    const name = body?.name;
    const document = body?.document;

    const patchData: Partial<typeof emailTemplates.$inferInsert> = {};
    if (name !== undefined) {
      patchData.name = await uniqueTemplateName(
        organizationId,
        String(name).trim(),
        id,
      );
    }
    if (document !== undefined) {
      patchData.document = document;
      patchData.subject = document?.subject || "";
      patchData.fromName = document?.fromName || "";
      patchData.fromEmail = document?.fromEmail || "";
    }
    patchData.updatedAt = new Date();

    const [updated] = await db
      .update(emailTemplates)
      .set(patchData)
      .where(
        and(
          eq(emailTemplates.id, id),
          eq(emailTemplates.organizationId, organizationId),
        ),
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ ok: false, error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, template: updated });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
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
    const [deleted] = await db
      .delete(emailTemplates)
      .where(
        and(
          eq(emailTemplates.id, id),
          eq(emailTemplates.organizationId, organizationId),
        ),
      )
      .returning();

    if (!deleted) {
      return NextResponse.json({ ok: false, error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { getTemplateWithVersion, templateVersion } from "@/db/content-version";
import { uniqueTemplateName } from "@/db/email-templates";
import { emailTemplates } from "@/db/schema";
import { currentOrganizationId } from "@/lib/auth-helpers";
import { isEmailDocument, type EmailDocument } from "@/lib/email/document";
import { sanitizeEmailDocument } from "@/lib/email/sanitize";

export const runtime = "nodejs";

type TemplateBody = {
  name?: unknown;
  document?: EmailDocument;
  /**
   * The version the editor loaded (db/content-version.ts). When present, the
   * save only applies if the design has not changed since; otherwise 409, so
   * a stale tab can't overwrite a newer save.
   */
  baseVersion?: unknown;
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
    const found = await getTemplateWithVersion(id, organizationId);

    if (!found) {
      return NextResponse.json({ ok: false, error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, template: found.template, version: found.version });
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
    if (body?.document !== undefined && !isEmailDocument(body.document)) {
      return NextResponse.json({ ok: false, error: "Valid document required" }, { status: 400 });
    }
    // Same rule as POST: what is stored is what other editors will open.
    const document = body?.document ? sanitizeEmailDocument(body.document) : undefined;

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
      patchData.subject = document.subject || "";
      patchData.fromName = document.fromName || "";
      patchData.fromEmail = document.fromEmail || "";
    }
    patchData.updatedAt = new Date();

    const baseVersion =
      typeof body?.baseVersion === "string" ? body.baseVersion : undefined;
    const [row] = await db
      .update(emailTemplates)
      .set(patchData)
      .where(
        and(
          eq(emailTemplates.id, id),
          eq(emailTemplates.organizationId, organizationId),
          baseVersion !== undefined ? sql`${templateVersion} = ${baseVersion}` : undefined,
        ),
      )
      .returning({ ...getTableColumns(emailTemplates), version: templateVersion });

    if (!row) {
      if (baseVersion !== undefined && (await getTemplateWithVersion(id, organizationId))) {
        return NextResponse.json(
          {
            ok: false,
            code: "conflict",
            error: "This template was changed somewhere else. Reload to get the latest version.",
          },
          { status: 409 },
        );
      }
      return NextResponse.json({ ok: false, error: "Template not found" }, { status: 404 });
    }

    const { version, ...updated } = row;
    return NextResponse.json({ ok: true, template: updated, version });
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

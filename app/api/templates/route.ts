import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { uniqueTemplateName } from "@/db/email-templates";
import { emailTemplates } from "@/db/schema";
import { currentOrganizationId } from "@/lib/auth-helpers";
import { isEmailDocument, type EmailDocument } from "@/lib/email/document";
import { sanitizeEmailDocument } from "@/lib/email/sanitize";

export const runtime = "nodejs";

type TemplateBody = {
  name?: unknown;
  document?: EmailDocument;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function GET() {
  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const list = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.organizationId, organizationId))
      .orderBy(desc(emailTemplates.createdAt));

    return NextResponse.json({ ok: true, templates: list });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => null)) as TemplateBody | null;
    const name = String(body?.name ?? "").trim();

    if (!name) {
      return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });
    }
    if (body?.document !== undefined && !isEmailDocument(body.document)) {
      return NextResponse.json({ ok: false, error: "Valid document required" }, { status: 400 });
    }
    // Templates are shared across workspaces by link and opened in other
    // people's editors, so the stored document must already be safe.
    const document = body?.document ? sanitizeEmailDocument(body.document) : undefined;

    const [template] = await db
      .insert(emailTemplates)
      .values({
        organizationId,
        name: await uniqueTemplateName(organizationId, name),
        subject: document?.subject || "",
        fromName: document?.fromName || "",
        fromEmail: document?.fromEmail || "",
        document,
      })
      .returning();

    return NextResponse.json({ ok: true, template });
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }
}

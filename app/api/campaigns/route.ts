// GET  — list all campaigns (newest first) for the campaigns dashboard page.
// POST — create a new DRAFT campaign from a chosen template (the create flow).

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { emailTemplates } from "@/db/schema";
import { compileEmailDocument } from "@/lib/email/compiler";
import { normalizeDocument } from "@/lib/email/document";
import {
  PREBUILT_TEMPLATES,
  blankDocument,
  resolveTemplateVariables,
} from "@/lib/email/templates";
import { createCampaign, listCampaignsForOrganization } from "@/db/campaigns";
import { getOrganizationForUser } from "@/db/organizations";
import { listVerifiedSendingDomains } from "@/db/sending-domains";
import { isAllowedFromEmail, SENDING_LOCALPART } from "@/lib/send/sender-identity";
import { currentOrganizationId, currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Organization required" }, { status: 428 });
  }
  try {
    const campaigns = await listCampaignsForOrganization(organizationId);
    return NextResponse.json({ ok: true, campaigns });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.MAIL_FROM) {
    return NextResponse.json({ ok: false, error: "MAIL_FROM missing" }, { status: 400 });
  }
  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Create an organization first" }, { status: 428 });
  }

  try {
    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : "Untitled Campaign";
    const templateId = typeof body?.templateId === "string" ? body.templateId : "blank";

    const [organization, verifiedDomains] = await Promise.all([
      getOrganizationForUser(userId, organizationId),
      listVerifiedSendingDomains(organizationId),
    ]);

    // Sender: the caller's choice if it's one they're allowed to use, else
    // the org's first verified custom domain, else the shared default.
    const requestedFrom =
      typeof body?.fromEmail === "string" ? body.fromEmail.trim().toLowerCase() : "";
    let fromEmail = verifiedDomains[0]
      ? `${SENDING_LOCALPART}@${verifiedDomains[0]}`
      : process.env.MAIL_FROM!;
    if (requestedFrom) {
      if (!isAllowedFromEmail(requestedFrom, verifiedDomains)) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "You can only send from the shared address or your verified domain.",
          },
          { status: 400 },
        );
      }
      fromEmail = requestedFrom;
    }

    // Build the starting design from the chosen template — prebuilt, one of
    // the org's own saved templates, or blank — and fill template placeholders
    // like {{organization}} so they never leak into a sent subject line.
    const template = PREBUILT_TEMPLATES.find((t) => t.id === templateId);
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let doc = template ? template.build() : null;
    if (!doc && UUID_RE.test(templateId)) {
      const [saved] = await db
        .select()
        .from(emailTemplates)
        .where(
          and(
            eq(emailTemplates.id, templateId),
            eq(emailTemplates.organizationId, organizationId),
          ),
        );
      if (saved?.document) {
        doc = normalizeDocument(JSON.parse(JSON.stringify(saved.document)));
      }
    }
    doc ??= blankDocument();
    resolveTemplateVariables(doc, {
      organization: organization?.name ?? "our team",
    });
    doc.name = name;
    doc.fromEmail = fromEmail;

    const { html, text } = compileEmailDocument(doc);
    const campaign = await createCampaign(userId, organizationId, {
      name,
      subject: doc.subject || "",
      fromName: doc.fromName || "LetterStack",
      fromEmail,
      html,
      text,
      document: doc,
    });

    return NextResponse.json({ ok: true, id: campaign.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

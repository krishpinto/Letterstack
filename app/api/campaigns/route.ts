// GET  — list all campaigns (newest first) for the campaigns dashboard page.
// POST — create a new DRAFT campaign from a chosen template (the create flow).

import { NextResponse } from "next/server";
import { compileEmailDocument } from "@/lib/email/compiler";
import { PREBUILT_TEMPLATES, blankDocument } from "@/lib/email/templates";
import { createCampaign, listCampaigns } from "@/db/campaigns";
import { getSendingSlug } from "@/db/users";
import { sendingAddressForSlug } from "@/lib/send/sender-identity";
import { currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const campaigns = await listCampaigns(userId);
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

  try {
    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : "Untitled Campaign";
    const templateId = typeof body?.templateId === "string" ? body.templateId : "blank";

    // Default sender = the account's branded subdomain address (or the shared
    // verified default if they haven't picked a slug yet). Editable per-campaign.
    const slug = await getSendingSlug(userId);
    const fromEmail = sendingAddressForSlug(slug);

    // Build the starting design from the chosen template (or blank).
    const template = PREBUILT_TEMPLATES.find((t) => t.id === templateId);
    const doc = template ? template.build() : blankDocument();
    doc.name = name;
    doc.fromEmail = fromEmail;

    const { html, text } = compileEmailDocument(doc);
    const campaign = await createCampaign(userId, {
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

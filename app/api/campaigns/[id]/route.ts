// GET   — one campaign (incl. its editable document) for the send page.
// PATCH — save a draft's design back: recompiles + freezes the snapshot.
//         This is the endpoint the editor should call to persist "Edit design".

import { NextResponse } from "next/server";
import { compileEmailDocument } from "@/lib/email/compiler";
import { isEmailDocument, normalizeDocument } from "@/lib/email/document";
import { deleteCampaign, getCampaignForUser, updateCampaignDraft } from "@/db/campaigns";
import { listVerifiedSendingDomains } from "@/db/sending-domains";
import { listMailboxesForUser } from "@/db/connected-mailboxes";
import { isAllowedFromEmail } from "@/lib/send/sender-identity";
import { currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const campaign = await getCampaignForUser(id, userId);
  if (!campaign) {
    return NextResponse.json({ ok: false, error: "Campaign not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, campaign });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const ok = await deleteCampaign(id, userId);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "Campaign not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);
    if (!isEmailDocument(body?.document)) {
      return NextResponse.json({ ok: false, error: "Valid document required" }, { status: 400 });
    }
    const doc = normalizeDocument(body.document);
    const { html, text } = compileEmailDocument(doc);

    // If the sender is being changed, it must be one this org may use.
    const nextFromEmail =
      typeof body?.fromEmail === "string" ? body.fromEmail : doc.fromEmail;
    const existing = await getCampaignForUser(id, userId);
    let senderType: string | undefined;
    let mailboxId: string | null | undefined;
    if (
      existing &&
      nextFromEmail &&
      nextFromEmail !== existing.fromEmail
    ) {
      const organizationId = existing.organizationId;
      const [verifiedDomains, mailboxes] = await Promise.all([
        listVerifiedSendingDomains(organizationId),
        listMailboxesForUser(userId, organizationId),
      ]);
      const activeMailboxes = mailboxes.filter((m) => m.status === "active");
      const normalized = nextFromEmail.toLowerCase();
      // A mailbox address is only usable by the person who connected it —
      // isAllowedFromEmail is org-scoped only, so this ownership check
      // happens here, where the requesting user is already in scope.
      const requestedMailbox = activeMailboxes.find((m) => m.email.toLowerCase() === normalized);
      const mailboxEmails = activeMailboxes.map((m) => m.email);

      if (!isAllowedFromEmail(normalized, verifiedDomains, mailboxEmails)) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "You can only send from the shared address, your verified domain, or a Gmail account you've connected.",
          },
          { status: 400 },
        );
      }

      if (requestedMailbox) {
        senderType = "mailbox";
        mailboxId = requestedMailbox.id;
      } else if (normalized === (process.env.MAIL_FROM ?? "").toLowerCase()) {
        senderType = "shared";
        mailboxId = null;
      } else {
        senderType = "domain";
        mailboxId = null;
      }
    }

    const updated = await updateCampaignDraft(id, userId, {
      name: typeof body?.name === "string" ? body.name : doc.name,
      subject: typeof body?.subject === "string" ? body.subject : doc.subject,
      fromName: typeof body?.fromName === "string" ? body.fromName : doc.fromName,
      fromEmail: typeof body?.fromEmail === "string" ? body.fromEmail : doc.fromEmail,
      replyTo:
        typeof body?.replyTo === "string"
          ? body.replyTo.trim() || null
          : body?.replyTo === null
            ? null
            : undefined,
      senderType,
      mailboxId,
      html,
      text,
      document: doc,
    });

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Campaign not found or already sent" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, campaign: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

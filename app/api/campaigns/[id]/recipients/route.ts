// One campaign's recipients with their status. Combines the campaign_recipients
// status (pending / sent / failed) with the suppression list to surface
// "bounced" (an address that SES later reported as a bounce/complaint).

import { NextResponse } from "next/server";
import {
  addCampaignRecipient,
  deleteCampaignRecipient,
  listCampaignRecipients,
} from "@/db/campaign-recipients";
import {
  isSuppressedForOrganization,
  listBouncedEmailsForOrganization,
} from "@/db/suppression";
import { getCampaignForUser } from "@/db/campaigns";
import { currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 404 if it isn't this user's campaign — don't leak another account's data.
    const campaign = await getCampaignForUser(id, userId);
    if (!campaign) {
      return NextResponse.json({ ok: false, error: "Campaign not found" }, { status: 404 });
    }

    const rows = await listCampaignRecipients(id);
    const bounced = await listBouncedEmailsForOrganization(campaign.organizationId);

    const recipients = rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      sentAt: r.sentAt,
      // If SES later bounced/complained this address, show that — it's the most
      // important status. Otherwise the send outcome.
      status: bounced.has(r.email) ? "bounced" : r.status,
      error: r.error,
    }));

    return NextResponse.json({ ok: true, recipients });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const campaign = await getCampaignForUser(id, userId);
    if (!campaign) {
      return NextResponse.json({ ok: false, error: "Campaign not found" }, { status: 404 });
    }
    if (campaign.status !== "draft") {
      return NextResponse.json(
        { ok: false, error: "Audience can only be changed before sending" },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => null);
    const email = String(body?.email ?? "").trim().toLowerCase();
    const name = String(body?.name ?? "").trim() || null;

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: "Valid email required" }, { status: 400 });
    }

    if (await isSuppressedForOrganization(campaign.organizationId, email)) {
      return NextResponse.json(
        { ok: false, error: "That email is suppressed for this organization" },
        { status: 400 },
      );
    }

    const row = await addCampaignRecipient(id, { email, name });
    if (!row) {
      return NextResponse.json(
        { ok: false, error: "That recipient is already on this campaign" },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true, recipient: row });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const campaign = await getCampaignForUser(id, userId);
    if (!campaign) {
      return NextResponse.json({ ok: false, error: "Campaign not found" }, { status: 404 });
    }
    if (campaign.status !== "draft") {
      return NextResponse.json(
        { ok: false, error: "Audience can only be changed before sending" },
        { status: 400 },
      );
    }

    const recipientId = new URL(request.url).searchParams.get("recipientId") ?? "";
    if (!recipientId) {
      return NextResponse.json({ ok: false, error: "recipientId required" }, { status: 400 });
    }

    const ok = await deleteCampaignRecipient(id, recipientId);
    if (!ok) {
      return NextResponse.json({ ok: false, error: "Recipient not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

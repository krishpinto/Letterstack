// One campaign's recipients with their status. Combines the campaign_recipients
// status (pending / sent / failed) with the suppression list to surface
// "bounced" (an address that SES later reported as a bounce/complaint).

import { NextResponse } from "next/server";
import { listCampaignRecipients } from "@/db/campaign-recipients";
import { listBouncedEmails } from "@/db/suppression";
import { getCampaignForUser } from "@/db/campaigns";
import { currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

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
    const bounced = await listBouncedEmails(userId);

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

// One campaign's recipients with their status. Combines the campaign_recipients
// status (pending / sent / failed) with the suppression list to surface
// "bounced" (an address that SES later reported as a bounce/complaint).

import { NextResponse } from "next/server";
import { listCampaignRecipients } from "@/db/campaign-recipients";
import { listBouncedEmails } from "@/db/suppression";

export const runtime = "nodejs";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  try {
    const rows = await listCampaignRecipients(id);
    const bounced = await listBouncedEmails();

    const recipients = rows.map((r) => ({
      id: r.id,
      email: r.email,
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

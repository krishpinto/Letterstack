// GET — beta send-cap usage for the Billing settings panel.

import { NextResponse } from "next/server";
import { getSendUsage } from "@/db/organizations";
import { listSendingDomains, SENDING_DOMAIN_LIMIT } from "@/db/sending-domains";
import { requireMember } from "@/lib/organizations/require-owner";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { error } = await requireMember(id);
  if (error) return error;

  const [sends, domains] = await Promise.all([
    getSendUsage(id),
    listSendingDomains(id),
  ]);

  return NextResponse.json({
    ok: true,
    sends,
    domains: { used: domains.length, limit: SENDING_DOMAIN_LIMIT },
  });
}

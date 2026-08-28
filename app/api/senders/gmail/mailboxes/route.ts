import { NextResponse } from "next/server";
import { getMailboxSendUsage, listMailboxesForUser } from "@/db/connected-mailboxes";
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

  const rows = await listMailboxesForUser(userId, organizationId);
  const mailboxes = await Promise.all(
    rows.map(async (row) => {
      const usage = await getMailboxSendUsage(row.id);
      return {
        id: row.id,
        email: row.email,
        displayName: row.displayName,
        status: row.status,
        lastError: row.lastError,
        dailyLimit: row.dailyLimit,
        sentToday: usage.used,
        createdAt: row.createdAt,
      };
    }),
  );

  return NextResponse.json({ ok: true, mailboxes });
}

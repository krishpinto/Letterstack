import { NextResponse } from "next/server";
import { deleteMailbox, getMailbox } from "@/db/connected-mailboxes";
import { revokeMailboxToken } from "@/lib/send/gmail-auth";
import { currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const mailbox = await getMailbox(id);
  if (!mailbox || mailbox.userId !== userId) {
    return NextResponse.json({ ok: false, error: "Mailbox not found" }, { status: 404 });
  }

  // Revoke with Google first, then remove locally — see the note on
  // revokeMailboxToken for why this can't just be a local delete.
  await revokeMailboxToken(mailbox);
  await deleteMailbox(id, userId);

  return NextResponse.json({ ok: true });
}

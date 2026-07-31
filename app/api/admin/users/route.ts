import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import {
  getAccessStatus,
  listUsersForAdmin,
  setAccessStatus,
  type AccessStatus,
} from "@/db/access";
import { sendWaitlistApprovedEmail } from "@/lib/waitlist-emails";

export const runtime = "nodejs";

const VALID_STATUSES: AccessStatus[] = ["pending", "approved", "rejected"];

export async function GET() {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const usersList = await listUsersForAdmin();
  return NextResponse.json({ ok: true, users: usersList });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!isAdmin(session?.user?.email) || !session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : null;
  const accessStatus = body?.accessStatus as AccessStatus | undefined;

  if (!userId || !accessStatus || !VALID_STATUSES.includes(accessStatus)) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const wasApproved = (await getAccessStatus(userId)) === "approved";

  const updated = await setAccessStatus(userId, accessStatus, session.user.id);
  if (!updated) {
    return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
  }

  // Only fire the approved-email on a genuine transition into approved —
  // an idempotent re-PATCH to the same status must not re-send it.
  if (accessStatus === "approved" && !wasApproved) {
    void sendWaitlistApprovedEmail(updated.email, updated.name).catch((err) => {
      console.error("Failed to send waitlist approved email", err);
    });
  }

  return NextResponse.json({ ok: true, user: updated });
}

import { NextResponse } from "next/server";

import { getAdminUserDetail } from "@/db/admin-users";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

export const runtime = "nodejs";

// Founder-only. Same gate as the rest of /api/admin/*.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const { userId } = await params;
  const user = await getAdminUserDetail(userId);
  if (!user) {
    return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, user });
}

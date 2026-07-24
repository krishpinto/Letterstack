// The signed-in user's profile.
// GET    → name, email, member-since.
// PUT    → update display name (email is the login identity — not editable
//          here; changing it needs its own verified-change flow, not built).
// DELETE → delete the account. Refuses if the caller is the sole owner of a
//          workspace that has other members (see deleteUserAccount).

import { NextResponse } from "next/server";
import {
  deleteUserAccount,
  getUserProfile,
  SoleOwnerError,
  updateUserName,
} from "@/db/users";
import { currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getUserProfile(userId);
  if (!profile) {
    return NextResponse.json({ ok: false, error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, profile });
}

export async function PUT(request: Request) {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (name.length < 1 || name.length > 120) {
    return NextResponse.json(
      { ok: false, error: "Name must be between 1 and 120 characters" },
      { status: 400 },
    );
  }

  const profile = await updateUserName(userId, name);
  if (!profile) {
    return NextResponse.json({ ok: false, error: "Account not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, profile });
}

export async function DELETE() {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    await deleteUserAccount(userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SoleOwnerError) {
      return NextResponse.json(
        {
          ok: false,
          error: `You're the only owner of ${error.organizationNames.join(", ")}, which ${error.organizationNames.length === 1 ? "has" : "have"} other members. Remove them or transfer/delete the workspace first.`,
        },
        { status: 409 },
      );
    }
    console.error("DELETE /api/account/profile failed", error);
    return NextResponse.json(
      { ok: false, error: "Could not delete account. Please try again." },
      { status: 500 },
    );
  }
}

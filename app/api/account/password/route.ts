// The signed-in account's password.
//
// PUT { currentPassword?, newPassword } — change it, or set one for the first
// time on an account that signed up through Google.
//
// Separate from /api/auth/reset, which proves identity with a one-time emailed
// token because the caller is by definition locked out. Here the caller has a
// live session, so the second factor is the current password: a session alone
// is not enough, or a borrowed laptop becomes a permanent account takeover.

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { getPasswordHash, setPasswordHash } from "@/db/users";
import { currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

/**
 * Matches /api/auth/reset. Signup still allows 6, which is a real
 * inconsistency in the codebase; 8 is the one worth keeping, so new and
 * changed passwords use it and signup is the thing to raise later.
 */
const MIN_LENGTH = 8;

/** Signup's cost, not reset's 10. Both exist today; the stronger one wins. */
const BCRYPT_COST = 12;

export async function PUT(request: Request) {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const currentPassword =
    typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (newPassword.length < MIN_LENGTH) {
    return NextResponse.json(
      { ok: false, error: `Use at least ${MIN_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const existing = await getPasswordHash(userId);

  if (existing) {
    if (!currentPassword) {
      return NextResponse.json(
        { ok: false, error: "Enter your current password." },
        { status: 400 },
      );
    }

    const valid = await bcrypt.compare(currentPassword, existing);
    if (!valid) {
      // 403, not 401: the session is fine, the second factor is not. A 401
      // would invite a client to treat this as "log in again".
      return NextResponse.json(
        { ok: false, error: "That current password is not right." },
        { status: 403 },
      );
    }

    // Refused because a "change" that changes nothing is almost always
    // someone who believes they have rotated a password they have not.
    if (await bcrypt.compare(newPassword, existing)) {
      return NextResponse.json(
        { ok: false, error: "That is already your password. Pick a different one." },
        { status: 400 },
      );
    }
  }

  // No existing hash means a Google-only account setting its first password.
  // The live session is the proof of identity there, since there is no current
  // password to ask for — and refusing would leave the account permanently
  // unable to add one.

  await setPasswordHash(userId, await bcrypt.hash(newPassword, BCRYPT_COST));

  // Deliberately does NOT invalidate other sessions. Sessions are stateless
  // JWTs with no adapter behind them, so there is no server-side list to
  // revoke and nothing here could honestly claim to have signed anyone out.
  // Saying so is better than a button that lies; the fix is a token-version
  // column checked in the jwt callback, which costs a database read on every
  // session refresh and is a decision of its own.
  return NextResponse.json({ ok: true, hadPassword: Boolean(existing) });
}

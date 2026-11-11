// POST — finish a password reset: redeem the emailed token (single-use,
// 1-hour expiry) and set the new password. Also signs out every existing
// session (see resetPassword).

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { consumePasswordResetToken } from "@/db/password-resets";
import { resetPassword } from "@/db/users";
import { BCRYPT_COST, MIN_PASSWORD_LENGTH } from "@/lib/auth-rules";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    token?: string;
    password?: string;
  } | null;
  const token = String(body?.token ?? "");
  const password = String(body?.password ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
      { status: 400 },
    );
  }

  try {
    const userId = await consumePasswordResetToken(token);
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "This reset link is invalid or has expired. Request a new one." },
        { status: 400 },
      );
    }

    await resetPassword(userId, await bcrypt.hash(password, BCRYPT_COST));

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// POST — finish a password reset: redeem the emailed token (single-use,
// 1-hour expiry) and set the new password.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { consumePasswordResetToken } from "@/db/password-resets";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    token?: string;
    password?: string;
  } | null;
  const token = String(body?.token ?? "");
  const password = String(body?.password ?? "");

  if (password.length < 8) {
    return NextResponse.json(
      { ok: false, error: "Password must be at least 8 characters" },
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

    const passwordHash = await bcrypt.hash(password, 10);
    await db.update(users).set({ passwordHash }).where(eq(users.id, userId));

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// POST — request a password reset. Always answers ok, whether or not the
// account exists, so the endpoint can't be used to probe which emails have
// accounts. The reset link goes out through our own SES transport.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { createPasswordResetToken } from "@/db/password-resets";
import { sendPasswordResetEmail } from "@/lib/auth-emails";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = String(body?.email ?? "").trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Valid email required" }, { status: 400 });
  }

  try {
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user) {
      const token = await createPasswordResetToken(user.id);
      await sendPasswordResetEmail(user.email, token);
    }

    // Same response either way — no account enumeration.
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(
      "forgot-password: failed to send reset email:",
      err instanceof Error ? err.message : err,
    );
    // Still don't leak whether the account exists.
    return NextResponse.json({ ok: true });
  }
}

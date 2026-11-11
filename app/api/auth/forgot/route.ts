// POST — request a password reset. Always answers ok, whether or not the
// account exists, so the endpoint can't be used to probe which emails have
// accounts. The reset link goes out through our own SES transport.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { createPasswordResetToken } from "@/db/password-resets";
import { sendPasswordResetEmail } from "@/lib/auth-emails";
import { clientIp, rateLimitAll, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOUR = 60 * 60 * 1000;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = String(body?.email ?? "").trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Valid email required" }, { status: 400 });
  }

  // Per email so nobody can flood a stranger's inbox with reset emails, per
  // IP so one machine can't do it to many inboxes. Answering 429 does say
  // "someone asked for this address recently", but not whether an account
  // exists: the count runs before the lookup, for every address.
  const limit = await rateLimitAll([
    { key: `forgot:email:${email}`, rule: { limit: 3, windowMs: HOUR } },
    { key: `forgot:ip:${clientIp(request.headers)}`, rule: { limit: 10, windowMs: HOUR } },
  ]);
  if (!limit.ok) return tooManyRequests(limit);

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

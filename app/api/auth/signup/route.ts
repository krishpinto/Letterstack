// POST — create a password account and email a link to verify the address.
//
// The account is usable straight away (the signup page signs in right after),
// but it can't send mail or hold admin rights until the email is verified:
// see requireVerifiedEmail in lib/auth-helpers.ts and lib/admin.ts. Proving
// the address also matters for Google sign-in, which takes over an account
// whose email was never proven (planGoogleClaim in lib/auth-rules.ts).

import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createEmailVerificationToken } from "@/db/email-verifications";
import { sendEmailVerificationEmail } from "@/lib/auth-emails";
import { BCRYPT_COST, MIN_PASSWORD_LENGTH } from "@/lib/auth-rules";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
    name?: unknown;
  } | null;
  const email = typeof body?.email === "string" ? body.email.toLowerCase().trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "Email and password are required" },
      { status: 400 },
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address" }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
      { status: 400 },
    );
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Kept as a distinct answer: the page signs in straight after signup, so
  // hiding it would only turn "this email has an account" into a confusing
  // sign-in failure.
  if (existing.length > 0) {
    return NextResponse.json(
      { ok: false, error: "An account with this email already exists. Log in instead." },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  const [user] = await db
    .insert(users)
    .values({ email, name: name || null, passwordHash })
    .returning({ id: users.id, email: users.email });

  // The account exists either way; a failed send just means the person asks
  // for a new link from /verify-email instead of finding one in their inbox.
  let verificationSent = true;
  try {
    const token = await createEmailVerificationToken(user.id);
    await sendEmailVerificationEmail(user.email, token);
  } catch (err) {
    verificationSent = false;
    console.error(
      "signup: failed to send verification email:",
      err instanceof Error ? err.message : err,
    );
  }

  return NextResponse.json({ ok: true, user, verificationSent });
}

// POST — email the signed-in user a fresh verification link. Minting a new
// token retires the previous one, so only the latest email's link works.

import { NextResponse } from "next/server";
import { createEmailVerificationToken } from "@/db/email-verifications";
import { auth } from "@/lib/auth";
import { sendEmailVerificationEmail } from "@/lib/auth-emails";

export const runtime = "nodejs";

export async function POST() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (user.hasVerifiedEmail) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  try {
    const token = await createEmailVerificationToken(user.id);
    await sendEmailVerificationEmail(user.email, token);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(
      "verify-email: failed to send verification email:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { ok: false, error: "Could not send the email. Try again in a minute." },
      { status: 502 },
    );
  }
}

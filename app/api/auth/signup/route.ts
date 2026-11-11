import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { BCRYPT_COST, MIN_PASSWORD_LENGTH } from "@/lib/auth-rules";

export async function POST(req: Request) {
  const { email, password, name } = await req.json();

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, error: "Email and password are required" },
      { status: 400 },
    );
  }

  const trimmedEmail = email.toLowerCase().trim();

  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
      { status: 400 },
    );
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, trimmedEmail))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json(
      { ok: false, error: "An account with this email already exists" },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  const [user] = await db
    .insert(users)
    .values({ email: trimmedEmail, name: name || null, passwordHash })
    .returning({ id: users.id, email: users.email });

  return NextResponse.json({ ok: true, user });
}

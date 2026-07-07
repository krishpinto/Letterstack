// Password reset tokens. The raw token only ever exists inside the emailed
// link; the database stores its sha256, so a leaked table can't reset
// anything. Tokens are single-use and short-lived, and requesting a new one
// invalidates any outstanding ones for that user.

import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "./client";
import { passwordResets } from "./schema";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

/** Mint a reset token for the user; returns the raw token for the email link. */
export async function createPasswordResetToken(userId: string): Promise<string> {
  // One live token per user: kill anything outstanding first.
  await db
    .update(passwordResets)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResets.userId, userId), isNull(passwordResets.usedAt)));

  const raw = randomBytes(32).toString("base64url");
  await db.insert(passwordResets).values({
    userId,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });

  return raw;
}

/**
 * Redeem a raw token: returns the userId and marks it used, or null if the
 * token is unknown, expired, or already used.
 */
export async function consumePasswordResetToken(raw: string): Promise<string | null> {
  if (!raw) return null;

  const [row] = await db
    .update(passwordResets)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(passwordResets.tokenHash, hashToken(raw)),
        isNull(passwordResets.usedAt),
        gt(passwordResets.expiresAt, new Date()),
      ),
    )
    .returning({ userId: passwordResets.userId });

  return row?.userId ?? null;
}

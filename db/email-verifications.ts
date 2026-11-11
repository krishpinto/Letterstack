// Email verification tokens. Same construction as db/password-resets.ts: the
// raw token only exists inside the emailed link, the table stores its sha256,
// tokens are single-use, and minting a new one retires any outstanding ones.

import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "./client";
import { emailVerifications, users } from "./schema";
import { markEmailVerified } from "./users";

// Longer than a reset link's hour: nobody is locked out while this one is
// outstanding, and people often verify the next morning.
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

/** Mint a verification token for the user; returns the raw token for the link. */
export async function createEmailVerificationToken(userId: string): Promise<string> {
  await db
    .update(emailVerifications)
    .set({ usedAt: new Date() })
    .where(and(eq(emailVerifications.userId, userId), isNull(emailVerifications.usedAt)));

  const raw = randomBytes(32).toString("base64url");
  await db.insert(emailVerifications).values({
    userId,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });
  return raw;
}

export type VerifyResult = "verified" | "already-verified" | "invalid";

/**
 * Redeem a raw token and mark the account's email verified.
 *
 * A token that was already used still answers "already-verified" when its
 * account is verified, so clicking the link twice (or a mail scanner having
 * fetched it first) reads as success rather than a scary error.
 */
export async function consumeEmailVerificationToken(raw: string): Promise<VerifyResult> {
  if (!raw) return "invalid";
  const tokenHash = hashToken(raw);

  const [row] = await db
    .update(emailVerifications)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(emailVerifications.tokenHash, tokenHash),
        isNull(emailVerifications.usedAt),
        gt(emailVerifications.expiresAt, new Date()),
      ),
    )
    .returning({ userId: emailVerifications.userId });

  if (row) {
    await markEmailVerified(row.userId);
    return "verified";
  }

  const [used] = await db
    .select({ verifiedAt: users.emailVerifiedAt })
    .from(emailVerifications)
    .innerJoin(users, eq(users.id, emailVerifications.userId))
    .where(eq(emailVerifications.tokenHash, tokenHash))
    .limit(1);

  return used?.verifiedAt ? "already-verified" : "invalid";
}

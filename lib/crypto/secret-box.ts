import crypto from "node:crypto";

/**
 * AES-256-GCM encryption for secrets that have to be stored, not just
 * verified — a Gmail refresh token, unlike the HMAC-signed unsubscribe
 * tokens in lib/email/unsubscribe.ts, has to be recoverable later to make
 * real API calls, so it needs real encryption rather than a one-way hash.
 *
 * Each secret gets its own random IV; the GCM auth tag is stored alongside
 * so tampering with the ciphertext is detected on decrypt rather than
 * silently producing garbage.
 */

const ALGORITHM = "aes-256-gcm";

function encryptionKey(): Buffer {
  const key = process.env.MAILBOX_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "MAILBOX_ENCRYPTION_KEY must be set (32 bytes, base64) before storing " +
        "any mailbox credential — refusing to store one in plaintext.",
    );
  }
  const buf = Buffer.from(key, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `MAILBOX_ENCRYPTION_KEY must decode to exactly 32 bytes (got ${buf.length}). ` +
        "Generate one with: openssl rand -base64 32",
    );
  }
  return buf;
}

export type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  tag: string;
};

export function encryptSecret(plaintext: string): EncryptedSecret {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptSecret(secret: EncryptedSecret): string {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    encryptionKey(),
    Buffer.from(secret.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(secret.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

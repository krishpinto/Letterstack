// Razorpay server-side client + signature verification.
//
// The key secret lives only in this module's process — it signs orders and
// validates callbacks, and must never be imported into a client component.
// Mirrors the env-var handling style used across lib/send/.

import crypto from "crypto";
import Razorpay from "razorpay";

/** Razorpay rejects anything under 1 rupee. */
export const MIN_AMOUNT_PAISE = 100;

/**
 * Env values pasted into a hosting dashboard routinely arrive with a
 * trailing newline or wrapped in quotes. Both look correct in the UI and
 * both make the credential wrong, so they're stripped here rather than
 * being left to fail as an unexplained 401 at request time.
 */
function cleanEnv(name: string): string {
  return (process.env[name] ?? "").trim().replace(/^["']|["']$/g, "").trim();
}

function credentials() {
  const keyId = cleanEnv("RAZORPAY_KEY_ID");
  const keySecret = cleanEnv("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) {
    throw new Error(
      "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set to take payments.",
    );
  }
  return { keyId, keySecret };
}

export function razorpayClient() {
  const { keyId, keySecret } = credentials();
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export async function createOrder(input: {
  amount: number;
  currency: string;
  receipt: string;
  /** Echoed back on every webhook — the thread for reconciling a payment. */
  notes?: Record<string, string>;
}) {
  return razorpayClient().orders.create({
    amount: input.amount,
    currency: input.currency,
    receipt: input.receipt,
    notes: input.notes,
  });
}

/**
 * Razorpay signs `order_id|payment_id` with the key secret. Recomputing it
 * here is what separates a real payment from a browser POSTing whatever it
 * likes at the verify endpoint — the checkout callback is never trusted on
 * its own.
 */
export function isValidPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const { keySecret } = credentials();
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");

  return safeEqualHex(expected, input.signature);
}

/**
 * Webhooks are signed with their own secret (set when you create the webhook
 * in the Razorpay dashboard), not the API key secret, and cover the raw
 * request body byte-for-byte — so the caller must hand us the unparsed text.
 */
export function isValidWebhookSignature(
  rawBody: string,
  signature: string,
): boolean {
  const secret = cleanEnv("RAZORPAY_WEBHOOK_SECRET");
  if (!secret) {
    throw new Error("RAZORPAY_WEBHOOK_SECRET must be set to accept webhooks.");
  }
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return safeEqualHex(expected, signature);
}

/**
 * timingSafeEqual, not `===`: signature comparison is the one place a
 * character-by-character early return leaks enough to forge against. It
 * throws on length mismatch, so that's checked first.
 */
function safeEqualHex(expected: string, received: string): boolean {
  if (typeof received !== "string" || expected.length !== received.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

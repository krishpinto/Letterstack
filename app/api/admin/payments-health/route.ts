// Founder-only diagnostic for the payment credentials actually loaded in
// this environment. Env vars are invisible from outside the process, so a
// "credentials are invalid" error is otherwise pure guesswork about which
// of four values is wrong.
//
// Reports shape, never content: mode, length, and whether the value carries
// the whitespace or wrapping quotes that a dashboard paste tends to bring
// with it. The secret itself is never returned.

import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export const runtime = "nodejs";

function describe(name: string) {
  const raw = process.env[name];
  if (raw === undefined) return { name, set: false as const };

  const trimmed = raw.trim();
  const unquoted = trimmed.replace(/^["']|["']$/g, "");
  return {
    name,
    set: true as const,
    length: raw.length,
    mode: unquoted.startsWith("rzp_live")
      ? "live"
      : unquoted.startsWith("rzp_test")
        ? "test"
        : null,
    // The two classic dashboard-paste faults. Either makes the credential
    // wrong while looking perfectly correct in the Vercel UI.
    hasSurroundingWhitespace: raw !== trimmed,
    hasWrappingQuotes: trimmed !== unquoted,
  };
}

export async function GET() {
  // Any signed-in user, deliberately not admin-gated: this exists to explain
  // a misconfiguration, so it must not depend on ADMIN_EMAILS being right.
  // It reports shape only and never returns a secret.
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const keyId = process.env.RAZORPAY_KEY_ID ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  const publicKeyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "";

  const env = [
    describe("RAZORPAY_KEY_ID"),
    describe("RAZORPAY_KEY_SECRET"),
    describe("NEXT_PUBLIC_RAZORPAY_KEY_ID"),
    describe("RAZORPAY_WEBHOOK_SECRET"),
  ];

  // The single most useful signal: do these two actually authenticate
  // together? A live id paired with a test secret looks fine in the
  // dashboard and fails with exactly the 401 this endpoint exists to explain.
  let auth_check: { status: number | null; ok: boolean; detail?: string } = {
    status: null,
    ok: false,
  };
  if (keyId && keySecret) {
    try {
      const r = await fetch("https://api.razorpay.com/v1/orders?count=1", {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${keyId.trim()}:${keySecret.trim()}`).toString("base64"),
        },
      });
      auth_check = { status: r.status, ok: r.ok };
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as
          | { error?: { description?: string } }
          | null;
        auth_check.detail = body?.error?.description ?? "unknown";
      }
    } catch (err) {
      auth_check = {
        status: null,
        ok: false,
        detail: err instanceof Error ? err.message : "request failed",
      };
    }
  }

  return NextResponse.json({
    ok: true,
    env,
    // A live key id with a test secret (or vice versa) is the usual cause of
    // an otherwise inexplicable 401.
    serverAndPublicKeyMatch: keyId.trim() === publicKeyId.trim(),
    keyPairModesAgree:
      describe("RAZORPAY_KEY_ID").mode ===
      describe("NEXT_PUBLIC_RAZORPAY_KEY_ID").mode,
    auth_check,
  });
}

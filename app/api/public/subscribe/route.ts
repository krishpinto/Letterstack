// Public, unauthenticated, cross-origin subscribe endpoint — the target of every
// embedded/hosted signup form. It never adds anyone to a list directly: a valid
// submission mints a signed confirm token and emails a confirm link (double
// opt-in). Only the confirm click (see ./confirm) lands the address in
// `recipients`, so bots stuffing this endpoint can't pollute the send list.
//
// CORS is wide open (Access-Control-Allow-Origin: *) on purpose — the form runs
// on the customer's own domain, and the only action possible here is "send a
// confirmation email to an address," which is self-limiting and safe.

import { NextResponse } from "next/server";
import { getSignupFormByPublicKey } from "@/db/signup-forms";
import { isSuppressedForOrganization } from "@/db/suppression";
import { recipientExists } from "@/db/recipients";
import { signSubscribeToken } from "@/lib/forms/token";
import { sendSubscribeConfirmationEmail } from "@/lib/forms/confirm-email";
import { appBaseUrl } from "@/lib/send/qstash";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

// Best-effort in-memory flood guard. Serverless instances are ephemeral and not
// shared, so this only blunts a burst hitting one warm instance — real defense
// is the honeypot + double opt-in. Keyed by IP+form.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > RATE_MAX;
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    key?: string;
    email?: string;
    name?: string;
    website?: string; // honeypot — real users never fill this
  } | null;

  // Honeypot tripped: pretend success so bots learn nothing.
  if (body?.website) return json({ ok: true });

  const key = String(body?.key ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const name = String(body?.name ?? "").trim() || null;

  if (!key) return json({ ok: false, error: "Missing form key" }, 400);
  if (!EMAIL_RE.test(email)) {
    return json({ ok: false, error: "Enter a valid email address" }, 400);
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(`${ip}:${key}`)) {
    return json({ ok: false, error: "Too many attempts — try again shortly" }, 429);
  }

  const form = await getSignupFormByPublicKey(key);
  if (!form) return json({ ok: false, error: "Form not found" }, 404);

  // Already unsubscribed/bounced, or already on the list: answer success
  // without sending anything (no re-add, no way to probe list membership).
  if (await isSuppressedForOrganization(form.organizationId, email)) {
    return json({ ok: true });
  }
  if (await recipientExists(form.organizationId, email)) {
    return json({ ok: true });
  }

  try {
    const token = signSubscribeToken({ formId: form.id, email, name });
    const confirmUrl = `${appBaseUrl()}/subscribe/confirm?t=${encodeURIComponent(token)}`;
    await sendSubscribeConfirmationEmail(form, email, confirmUrl);
    return json({ ok: true });
  } catch (err) {
    console.error("POST /api/public/subscribe failed", err);
    return json(
      { ok: false, error: "Could not send the confirmation email. Try again." },
      502,
    );
  }
}

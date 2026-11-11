// Public, unauthenticated, cross-origin subscribe endpoint — the target of every
// embedded/hosted signup form. Single opt-in: a valid submission is added to the
// org's audience immediately (no confirmation email). The honeypot + rate limits
// (lib/forms/subscribe-limits.ts) are the only bot guards, so a bad address that
// gets past them lands directly in the send list — re-introduce a confirm step
// if bounces ever climb.
//
// CORS is wide open (Access-Control-Allow-Origin: *) on purpose — the form runs
// on the customer's own domain.

import { NextResponse } from "next/server";
import {
  getSignupFormByPublicKey,
  incrementSubscriberCount,
} from "@/db/signup-forms";
import { isSuppressedForOrganization } from "@/db/suppression";
import { addRecipient } from "@/db/recipients";
import { checkContactHeadroom } from "@/lib/plans/guards";
import { enqueueAutomationsForEvent } from "@/lib/automations/run";
import { subscribeRateLimitChecks } from "@/lib/forms/subscribe-limits";
import { clientIp, rateLimitAll } from "@/lib/rate-limit";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

function json(data: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(data, { status, headers: { ...CORS_HEADERS, ...headers } });
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

  // Counted in Postgres so every serverless instance shares the counters (the
  // old in-memory map only saw requests that hit the same warm instance).
  // Checked before the form lookup so a flood of junk keys is cut off too.
  const limited = await rateLimitAll(
    subscribeRateLimitChecks(key, clientIp(request.headers)),
  );
  if (!limited.ok) {
    return json(
      { ok: false, error: "Too many attempts — try again shortly" },
      429,
      { "Retry-After": String(limited.retryAfterSeconds) },
    );
  }

  const form = await getSignupFormByPublicKey(key);
  if (!form) return json({ ok: false, error: "Form not found" }, 404);

  // Never resurrect an unsubscribed/bounced address; answer success without
  // adding so membership can't be probed.
  if (await isSuppressedForOrganization(form.organizationId, email)) {
    return json({ ok: true });
  }

  // A full audience stops new signups. The visitor is a member of the
  // public, not the customer, so they get a neutral "not accepting signups"
  // rather than the owner's billing state — which would both confuse them
  // and advertise the org's plan to anyone who loads the form.
  const headroom = await checkContactHeadroom(form.organizationId, 1);
  if (!headroom.ok) {
    return json(
      { ok: false, error: "This list isn't accepting new signups right now." },
      503,
    );
  }

  // Add straight to the audience. onConflictDoNothing returns null when the
  // address is already present, so only a new subscriber bumps the tally and
  // fires "contact added" automations (the welcome flow). Someone already on
  // the list re-submitting the form must not get the welcome email again.
  const inserted = await addRecipient(form.organizationId, form.userId, {
    email,
    name,
  });
  if (inserted) {
    await incrementSubscriberCount(form.id);
    // Never throws: an automation failure must not fail the signup.
    await enqueueAutomationsForEvent(form.organizationId, "contact.added", [
      {
        id: inserted.id,
        email: inserted.email,
        name: inserted.name,
        userId: inserted.userId,
      },
    ]);
  }

  return json({ ok: true });
}

import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { suppressedEmails } from "@/db/schema";
import {
  listSuppressedEmailsForOrganization,
  suppressEmailForOrganization,
} from "@/db/suppression";
import { currentOrganizationId, currentUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";

// Per-request cap for the bulk forms below; the contacts page splits larger
// selections into several requests.
const MAX_BULK = 1_000;

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** `{ emails: [...] }` → unique, normalized, non-empty addresses. */
function emailList(body: unknown): string[] | null {
  const raw = (body as { emails?: unknown } | null)?.emails;
  if (!Array.isArray(raw)) return null;
  return [...new Set(raw.map(normalizeEmail).filter(Boolean))];
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Organization required" }, { status: 428 });
  }

  try {
    const suppressed = await listSuppressedEmailsForOrganization(organizationId);
    return NextResponse.json({ ok: true, suppressed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * Suppress manually. Accepts `{ email }` (one address) or `{ emails: [...] }`
 * (bulk, one statement). The bulk form reports how many rows were new and
 * how many addresses were already suppressed, for any reason.
 */
export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Organization required" }, { status: 428 });
  }

  try {
    const body = await request.json().catch(() => null);

    const emails = emailList(body);
    if (emails) {
      if (emails.length === 0) {
        return NextResponse.json({ ok: false, error: "emails must not be empty" }, { status: 400 });
      }
      if (emails.length > MAX_BULK) {
        return NextResponse.json(
          { ok: false, error: `Suppress at most ${MAX_BULK} addresses per request` },
          { status: 400 },
        );
      }
      const inserted = await db
        .insert(suppressedEmails)
        .values(emails.map((email) => ({ organizationId, userId, email, reason: "manual" })))
        .onConflictDoNothing({
          target: [suppressedEmails.organizationId, suppressedEmails.email],
        })
        .returning({ email: suppressedEmails.email });
      return NextResponse.json({
        ok: true,
        suppressed: inserted.length,
        alreadySuppressed: emails.length - inserted.length,
      });
    }

    const email = normalizeEmail(body?.email);
    if (!email) {
      return NextResponse.json({ ok: false, error: "Email is required" }, { status: 400 });
    }

    await suppressEmailForOrganization(organizationId, userId, email, "manual");
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * Unsuppress: `{ emails: [...] }`. Only removes this organization's MANUAL
 * suppressions. Bounces and complaints stay (sending to them again damages
 * the sender's reputation), and so do unsubscribes (only the person can
 * undo their own opt-out). Those come back in `refused` with their reason.
 */
export async function DELETE(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Organization required" }, { status: 428 });
  }

  try {
    const body = await request.json().catch(() => null);
    const emails = emailList(body);
    if (!emails || emails.length === 0) {
      return NextResponse.json({ ok: false, error: "emails required" }, { status: 400 });
    }
    if (emails.length > MAX_BULK) {
      return NextResponse.json(
        { ok: false, error: `Unsuppress at most ${MAX_BULK} addresses per request` },
        { status: 400 },
      );
    }

    const removedRows = await db
      .delete(suppressedEmails)
      .where(
        and(
          eq(suppressedEmails.organizationId, organizationId),
          eq(suppressedEmails.reason, "manual"),
          inArray(suppressedEmails.email, emails),
        ),
      )
      .returning({ email: suppressedEmails.email });
    const removed = removedRows.map((row) => row.email);
    const removedSet = new Set(removed);

    const remaining = emails.filter((email) => !removedSet.has(email));
    const refused =
      remaining.length > 0
        ? await db
            .select({ email: suppressedEmails.email, reason: suppressedEmails.reason })
            .from(suppressedEmails)
            .where(
              and(
                eq(suppressedEmails.organizationId, organizationId),
                inArray(suppressedEmails.email, remaining),
              ),
            )
        : [];
    const refusedSet = new Set(refused.map((row) => row.email));

    return NextResponse.json({
      ok: true,
      removed,
      refused,
      // Not suppressed in this workspace at all (already unsuppressed).
      notSuppressed: remaining.filter((email) => !refusedSet.has(email)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

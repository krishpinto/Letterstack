// Public, unauthenticated unsubscribe endpoint. The token in `?t=` is a signed
// (organization, user, email) claim minted at send time, so we can suppress
// without a login and without trusting the URL contents.
//
// GET  — verify only (returns the email). We DON'T suppress on GET: link
//        scanners / mail prefetchers fire GETs and would unsubscribe people
//        who never clicked.
// POST — actually suppress. Serves both the RFC 8058 one-click flow (the mail
//        provider POSTs here directly) and our confirm page.

import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import {
  legacyUnsubscribeOrganizations,
  verifyUnsubscribeToken,
} from "@/lib/email/unsubscribe";
import {
  legacyUnsubscribeSources,
  suppressEmailForOrganization,
} from "@/db/suppression";
import { db } from "@/db/client";
import { recipients } from "@/db/schema";
import { enqueueAutomationsForEvent } from "@/lib/automations/run";

export const runtime = "nodejs";

function tokenFrom(request: Request): string {
  return new URL(request.url).searchParams.get("t") ?? "";
}

/** Postgres foreign_key_violation, possibly wrapped by drizzle. */
function isForeignKeyViolation(err: unknown): boolean {
  const code = (e: unknown) => (e as { code?: unknown } | null)?.code;
  return (
    code(err) === "23503" ||
    code((err as { cause?: unknown } | null)?.cause) === "23503"
  );
}

export async function GET(request: Request) {
  const claim = verifyUnsubscribeToken(tokenFrom(request));
  if (!claim) {
    return NextResponse.json({ ok: false, error: "Invalid or expired link" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, email: claim.email });
}

export async function POST(request: Request) {
  const claim = verifyUnsubscribeToken(tokenFrom(request));
  if (!claim) {
    return NextResponse.json({ ok: false, error: "Invalid or expired link" }, { status: 400 });
  }

  // New tokens name the workspace that sent the email. Old ones only name
  // the sending user, so they suppress in every workspace that could have
  // sent it (see legacyUnsubscribeOrganizations).
  const targets = claim.organizationId
    ? [claim.organizationId]
    : legacyUnsubscribeOrganizations(
        await legacyUnsubscribeSources(claim.userId, claim.email),
      );

  if (targets.length === 0) {
    // A legacy token whose user is in no workspace and never sent to this
    // address from one. Nothing can mail them under this sender any more.
    console.warn(`unsubscribe: no workspace to suppress ${claim.email} in`);
  }

  const newlySuppressed: string[] = [];
  for (const organizationId of targets) {
    try {
      const added = await suppressEmailForOrganization(
        organizationId,
        claim.userId,
        claim.email,
        "unsubscribe",
      );
      if (added) newlySuppressed.push(organizationId);
    } catch (err) {
      // The workspace (or the user the token names) has been deleted since
      // the email went out. Nobody is left to mail them from it.
      if (isForeignKeyViolation(err)) continue;
      throw err;
    }
  }

  // Fire "contact unsubscribed" automations only in the workspaces this
  // request actually unsubscribed them from. Another workspace that happens
  // to hold the same address has not been unsubscribed from, and its flows
  // (which may delete the contact) must not run. Suppression is recorded
  // first, so a send step in such a flow skips this contact.
  if (newlySuppressed.length > 0) {
    const rows = await db
      .select()
      .from(recipients)
      .where(
        and(
          eq(recipients.email, claim.email),
          inArray(recipients.organizationId, newlySuppressed),
        ),
      );
    for (const row of rows) {
      await enqueueAutomationsForEvent(row.organizationId, "contact.unsubscribed", [
        { id: row.id, email: row.email, name: row.name, userId: row.userId },
      ]);
    }
  }

  return NextResponse.json({ ok: true, email: claim.email });
}

// Confirm step of double opt-in. The link in the confirmation email points at
// the /subscribe/confirm PAGE, which verifies the token server-side (GET here)
// and then POSTs to actually add the subscriber. Splitting verify (GET) from
// commit (POST) means mail scanners that merely prefetch the link never confirm
// anyone — same guard the unsubscribe route uses.

import { NextResponse } from "next/server";
import { verifySubscribeToken } from "@/lib/forms/token";
import {
  getSignupFormById,
  incrementSubscriberCount,
} from "@/db/signup-forms";
import { isSuppressedForOrganization } from "@/db/suppression";
import { addRecipient } from "@/db/recipients";

export const runtime = "nodejs";

function tokenFrom(request: Request): string {
  return new URL(request.url).searchParams.get("t") ?? "";
}

export async function GET(request: Request) {
  const claim = verifySubscribeToken(tokenFrom(request));
  if (!claim) {
    return NextResponse.json(
      { ok: false, error: "Invalid or expired link" },
      { status: 400 },
    );
  }
  const form = await getSignupFormById(claim.formId);
  if (!form) {
    return NextResponse.json(
      { ok: false, error: "This form no longer exists" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, email: claim.email, headline: form.headline });
}

export async function POST(request: Request) {
  const claim = verifySubscribeToken(tokenFrom(request));
  if (!claim) {
    return NextResponse.json(
      { ok: false, error: "Invalid or expired link" },
      { status: 400 },
    );
  }

  const form = await getSignupFormById(claim.formId);
  if (!form) {
    return NextResponse.json(
      { ok: false, error: "This form no longer exists" },
      { status: 404 },
    );
  }

  // They may have unsubscribed/bounced between submitting and confirming — never
  // resurrect a suppressed address.
  if (await isSuppressedForOrganization(form.organizationId, claim.email)) {
    return NextResponse.json({ ok: true, email: claim.email });
  }

  const inserted = await addRecipient(form.organizationId, form.userId, {
    email: claim.email,
    name: claim.name,
  });
  // onConflictDoNothing returns null when the address was already present, so we
  // only bump the tally on a genuinely new subscriber.
  if (inserted) await incrementSubscriberCount(form.id);

  return NextResponse.json({ ok: true, email: claim.email });
}

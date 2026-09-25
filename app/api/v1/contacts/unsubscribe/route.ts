// POST /api/v1/contacts/unsubscribe — stop mailing an address, permanently
//
// Writes to the same suppression table that hard bounces and complaints go
// into, which every send path and every list import already checks. That is
// what makes this stick where a plain delete doesn't: re-importing the
// address later adds the row back, but the suppression still vetoes the send.
//
// The address goes in the body rather than the path on purpose — an email in
// a URL needs encoding, and URLs end up in access logs and Referer headers.

import { suppressEmailForOrganization } from "@/db/suppression";
import { apiError, apiOk, normalizeEmail, readJsonBody } from "@/lib/api/errors";
import { withApiKey } from "@/lib/api/with-api-key";

export const runtime = "nodejs";

export const POST = withApiKey("contacts:write", async (request, ctx) => {
  const parsed = await readJsonBody<{ email?: unknown }>(request);
  if ("error" in parsed) return parsed.error;

  const email = normalizeEmail(parsed.body.email);
  if (!email) {
    return apiError(400, "invalid_request", "A valid `email` is required.");
  }

  // onConflictDoNothing inside, so unsubscribing an already-unsubscribed
  // address succeeds quietly — a retrying client shouldn't see an error for
  // reaching the state it asked for.
  await suppressEmailForOrganization(ctx.organizationId, ctx.actorUserId, email, "unsubscribe");

  return apiOk({ email, unsubscribed: true });
});

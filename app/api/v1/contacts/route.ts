// GET  /api/v1/contacts  — a cursor-paginated page of the audience
// POST /api/v1/contacts  — add a contact, or return the existing one
//
// The upsert is the whole reason this API exists: someone with users
// signing up in their own product wants them in the newsletter audience
// without exporting a CSV every week.

import { getRecipientByEmail, addRecipient, listRecipientsPage } from "@/db/recipients";
import { apiError, apiOk, normalizeEmail, readJsonBody } from "@/lib/api/errors";
import { buildPage, decodeCursor, parsePageSize } from "@/lib/api/pagination";
import { serializeContact } from "@/lib/api/serializers";
import { withApiKey } from "@/lib/api/with-api-key";
import { checkContactHeadroom } from "@/lib/plans/guards";

export const runtime = "nodejs";

export const GET = withApiKey("contacts:read", async (request, ctx) => {
  const url = new URL(request.url);
  const limit = parsePageSize(url.searchParams.get("limit"));
  const cursor = decodeCursor(url.searchParams.get("cursor"));

  const rows = await listRecipientsPage(ctx.organizationId, limit, cursor);
  const { page, nextCursor } = buildPage(rows, limit);

  return apiOk({
    data: page.map(serializeContact),
    // Echoed back as ?cursor=… for the next page. Null means this was the last.
    nextCursor,
    hasMore: nextCursor !== null,
  });
});

export const POST = withApiKey("contacts:write", async (request, ctx) => {
  const parsed = await readJsonBody<{ email?: unknown; name?: unknown }>(request);
  if ("error" in parsed) return parsed.error;

  const email = normalizeEmail(parsed.body.email);
  if (!email) {
    return apiError(400, "invalid_request", "A valid `email` is required.");
  }

  const name = typeof parsed.body.name === "string" ? parsed.body.name.trim() || null : null;

  // Idempotent by nature: adding someone already on the list is a success,
  // not a conflict, because a customer's sync loop will re-send the same
  // people on every run and shouldn't have to special-case that.
  const existing = await getRecipientByEmail(ctx.organizationId, email);
  if (existing) {
    return apiOk({ contact: serializeContact(existing), created: false });
  }

  // The same guard the import wizard walks into. The API must not be a way
  // around a plan limit — if it read the table directly, every ceiling in
  // lib/plans would become optional for anyone holding a key.
  const headroom = await checkContactHeadroom(ctx.organizationId, 1);
  if (!headroom.ok) {
    return apiError(402, "contact_limit_reached", headroom.message ?? "Contact limit reached.");
  }

  const row = await addRecipient(ctx.organizationId, ctx.actorUserId, { email, name });
  if (!row) {
    // Lost a race with a concurrent insert of the same address. The unique
    // constraint did its job; re-read and report it as the success it is.
    const raced = await getRecipientByEmail(ctx.organizationId, email);
    if (raced) return apiOk({ contact: serializeContact(raced), created: false });
    return apiError(500, "internal_error", "Could not add that contact.");
  }

  return apiOk({ contact: serializeContact(row), created: true }, 201);
});

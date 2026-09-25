// DELETE /api/v1/contacts/:id — remove a contact from the audience
//
// Note what this is NOT: deleting a contact is not unsubscribing them. It
// removes the row, which means a later import can add the same address
// straight back. To stop mailing someone for good, POST
// /api/v1/contacts/unsubscribe, which writes a suppression that every send
// path and every import checks.

import { deleteRecipient } from "@/db/recipients";
import { apiError, apiOk } from "@/lib/api/errors";
import { withApiKey } from "@/lib/api/with-api-key";

export const runtime = "nodejs";

type Route = { params: Promise<{ id: string }> };

export const DELETE = withApiKey<Route>(
  "contacts:write",
  async (_request, ctx, route) => {
    const { id } = await route.params;

    // deleteRecipient is org-scoped, so an id from another workspace reads
    // as "not found" rather than deleting someone else's row.
    const removed = await deleteRecipient(ctx.organizationId, id);
    if (!removed) {
      return apiError(404, "not_found", "No contact with that id in this workspace.");
    }

    return apiOk({ deleted: true, id });
  },
);

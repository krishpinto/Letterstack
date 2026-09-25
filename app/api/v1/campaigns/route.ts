// GET /api/v1/campaigns — every campaign in the workspace, newest first
//
// Not paginated, unlike contacts: a workspace has tens of campaigns where it
// has thousands of contacts. If that stops being true, this grows a cursor
// the same way — which is why the response is already shaped as { data },
// so adding nextCursor later is additive rather than breaking.

import { listCampaignsForOrganization } from "@/db/campaigns";
import { apiOk } from "@/lib/api/errors";
import { serializeCampaign } from "@/lib/api/serializers";
import { withApiKey } from "@/lib/api/with-api-key";

export const runtime = "nodejs";

export const GET = withApiKey("campaigns:read", async (_request, ctx) => {
  const rows = await listCampaignsForOrganization(ctx.organizationId);
  return apiOk({ data: rows.map(serializeCampaign) });
});

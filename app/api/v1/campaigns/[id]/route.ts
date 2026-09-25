// GET /api/v1/campaigns/:id — one campaign, with delivery progress and stats
//
// Progress and engagement answer different questions and both are worth
// returning. Progress is what OUR send path did (how many of the audience
// have been handed to SES). Engagement is what happened AFTERWARDS,
// assembled from the SES events that arrive over SNS — delivered, bounced,
// opened, clicked. A campaign can be 100% sent and still have delivery
// events landing minutes later.

import { getCampaign } from "@/db/campaigns";
import { campaignProgress } from "@/db/campaign-recipients";
import { campaignEngagement } from "@/db/events";
import { apiError, apiOk } from "@/lib/api/errors";
import { serializeCampaign } from "@/lib/api/serializers";
import { withApiKey } from "@/lib/api/with-api-key";

export const runtime = "nodejs";

type Route = { params: Promise<{ id: string }> };

export const GET = withApiKey<Route>("campaigns:read", async (_request, ctx, route) => {
  const { id } = await route.params;

  // getCampaign is NOT org-scoped — it takes a bare id — so the ownership
  // check has to happen here. Same 404 for "doesn't exist" and "belongs to
  // someone else", because distinguishing them confirms an id is real.
  const campaign = await getCampaign(id);
  if (!campaign || campaign.organizationId !== ctx.organizationId) {
    return apiError(404, "not_found", "No campaign with that id in this workspace.");
  }

  const [progress, engagement] = await Promise.all([
    campaignProgress(id),
    campaignEngagement(id),
  ]);

  return apiOk({
    campaign: serializeCampaign(campaign),
    progress,
    // Delivered and bounced are hard counts from SES. Opens are estimates —
    // privacy proxies pre-fetch tracking pixels, so they read high. Worth
    // knowing before anyone builds a dashboard on them.
    engagement,
  });
});

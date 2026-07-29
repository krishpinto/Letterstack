// Workspace dashboard payload: headline stats + daily activity series +
// recent campaigns (with engagement) + recent saved templates, in one call.

import { NextResponse } from "next/server";
import { count, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { emailTemplates, signupForms } from "@/db/schema";
import { listCampaignsForOrganization } from "@/db/campaigns";
import { dashboardSeries, dashboardStats } from "@/db/dashboard";
import { engagementByOrganization } from "@/db/events";
import { listAutomationsForOrganization } from "@/db/automations";
import { listSendingDomains } from "@/db/sending-domains";
import { currentOrganizationId } from "@/lib/auth-helpers";
import { baseSendingDomain } from "@/lib/send/sender-identity";

export const runtime = "nodejs";

export async function GET() {
  const organizationId = await currentOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [stats, series, campaigns, engagement, templates, templatesTotal, automations, domains, formsTotal] =
      await Promise.all([
        dashboardStats(organizationId),
        dashboardSeries(organizationId, 14),
        listCampaignsForOrganization(organizationId),
        engagementByOrganization(organizationId),
        db
          .select({
            id: emailTemplates.id,
            name: emailTemplates.name,
            updatedAt: emailTemplates.updatedAt,
          })
          .from(emailTemplates)
          .where(eq(emailTemplates.organizationId, organizationId))
          .orderBy(desc(emailTemplates.updatedAt))
          .limit(4),
        db
          .select({ count: count() })
          .from(emailTemplates)
          .where(eq(emailTemplates.organizationId, organizationId))
          .then((rows) => rows[0]?.count ?? 0),
        listAutomationsForOrganization(organizationId),
        listSendingDomains(organizationId),
        db
          .select({ count: count() })
          .from(signupForms)
          .where(eq(signupForms.organizationId, organizationId))
          .then((rows) => rows[0]?.count ?? 0),
      ]);

    const recentCampaigns = campaigns.slice(0, 6).map((c) => {
      const e = engagement.get(c.id);
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        audienceCount: c.audienceCount,
        sentCount: c.sentCount,
        openRate:
          e && e.delivered > 0
            ? Math.round((e.opensUnique / e.delivered) * 100)
            : null,
        sentAt: c.sentAt,
        createdAt: c.createdAt,
      };
    });

    const verifiedDomains = domains.filter((d) => d.verifiedAt).map((d) => d.domain);

    return NextResponse.json({
      ok: true,
      organizationId,
      stats,
      series,
      recentCampaigns,
      recentTemplates: templates,
      services: {
        campaignsTotal: campaigns.length,
        templatesTotal,
        automationsTotal: automations.length,
        automationsEnabled: automations.filter((a) => a.status === "enabled").length,
        formsTotal,
        domainsVerified: verifiedDomains,
        domainsTotal: domains.length,
        defaultSendingDomain: baseSendingDomain(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

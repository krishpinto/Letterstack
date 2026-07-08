"use client";

// Workspace dashboard: headline stats with week-over-week movement, recent
// campaign activity, delivery/open charts, and recent templates. Full-bleed —
// the shell hides both sidebars on this route.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  BarChart3Icon,
  CalendarIcon,
  GlobeIcon,
  MailCheckIcon,
  MailIcon,
  MailOpenIcon,
  PenLineIcon,
  PlusIcon,
  SendIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { CampaignStatusIcon } from "@/components/campaign-status-icon";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartCard } from "@/components/ui/chart-card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { IconStack } from "@/components/reui/icon-stack";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatFrameCard } from "@/components/ui/stat-frame-card";
import { PageLoader } from "@/components/bar-spinner";
import {
  EvilAreaChart,
  Area as EvilArea,
  XAxis as EvilAreaXAxis,
  YAxis as EvilAreaYAxis,
  Grid as EvilAreaGrid,
  Tooltip as EvilAreaTooltip,
} from "@/components/evilcharts/charts/area-chart";
import {
  EvilRadialChart,
  RadialBar as EvilRadialBar,
  Tooltip as EvilRadialTooltip,
  Legend as EvilRadialLegend,
} from "@/components/evilcharts/charts/radial-chart";
import { PolarAngleAxis } from "recharts";
import type { ChartConfig as EvilChartConfig } from "@/components/evilcharts/ui/chart";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stats = {
  audience: number;
  audienceNew7: number;
  audiencePrev7: number;
  campaignsSent: number;
  campaignsSent7: number;
  campaignsSentPrev7: number;
  delivered: number;
  delivered7: number;
  deliveredPrev7: number;
  opensUnique: number;
  openRate: number;
};

type SeriesPoint = { date: string; delivered: number; opened: number };

type RecentCampaign = {
  id: string;
  name: string;
  status: string;
  audienceCount: number;
  sentCount: number;
  openRate: number | null;
  sentAt: string | null;
  createdAt: string;
};

type RecentTemplate = { id: string; name: string; updatedAt: string };

type Services = {
  campaignsTotal: number;
  templatesTotal: number;
  automationsTotal: number;
  automationsEnabled: number;
  domainsVerified: string[];
  domainsTotal: number;
  defaultSendingDomain: string;
};

type DashboardData = {
  stats: Stats;
  series: SeriesPoint[];
  recentCampaigns: RecentCampaign[];
  recentTemplates: RecentTemplate[];
  services: Services;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function weekTrend(current: number, previous: number) {
  if (previous === 0 && current === 0) return undefined;
  if (previous === 0) return { value: 100, label: "vs last week" };
  return {
    value: Math.round(((current - previous) / previous) * 100),
    label: "vs last week",
  };
}

function shortDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

const RECENT_CAMPAIGNS_COLLAPSED_COUNT = 4;

const emailActivityConfig = {
  delivered: { label: "Delivered", colors: { light: ["#0284c7"], dark: ["#38bdf8"] } },
  opened: { label: "Opened", colors: { light: ["#059669"], dark: ["#34d399"] } },
} satisfies EvilChartConfig;

// One color per campaign ring in the radial open-rate chart, cycled if there
// are more campaigns than colors.
const OPEN_RATE_PALETTE = [
  { light: ["#7c3aed"], dark: ["#a78bfa"] }, // purple
  { light: ["#0284c7"], dark: ["#38bdf8"] }, // sky
  { light: ["#059669"], dark: ["#34d399"] }, // emerald
  { light: ["#db2777"], dark: ["#f472b6"] }, // pink
  { light: ["#d97706"], dark: ["#fbbf24"] }, // amber
];

const MAX_OPEN_RATE_RINGS = 5;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardHome() {
  const { data: session } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((payload) => {
        if (payload.ok) setData(payload);
        else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Could not load the dashboard. Refresh to retry.
      </div>
    );
  }
  if (!data) return <PageLoader className="h-full" />;

  const { stats, series, recentCampaigns, recentTemplates, services } = data;
  const firstName = (session?.user?.name ?? "there").split(/\s+/)[0];
  const today = new Date().toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const activeDomain =
    services.domainsVerified[0] ?? services.defaultSendingDomain;
  // Each campaign with a known open rate becomes one radial ring. Keys are
  // CSS/SVG-safe slugs (they become gradient ids + color vars); the campaign
  // name rides along as the config label for the tooltip/legend.
  const ratedCampaigns = recentCampaigns
    .filter((c) => c.openRate !== null)
    .slice(0, MAX_OPEN_RATE_RINGS);
  const openRateRings = ratedCampaigns.map((c, i) => ({
    key: `c${i}`,
    openRate: c.openRate as number,
  }));
  const openRateRingConfig = Object.fromEntries(
    ratedCampaigns.map((c, i) => [
      `c${i}`,
      {
        label: c.name || "Untitled campaign",
        colors: OPEN_RATE_PALETTE[i % OPEN_RATE_PALETTE.length],
      },
    ]),
  ) satisfies EvilChartConfig;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {/* ── Welcome header ── */}
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">
            Welcome back, {firstName}!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here&apos;s how your newsletters are doing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground">
            <CalendarIcon className="size-3.5" />
            {today}
          </span>
          <Button asChild>
            <Link href="/dashboard/campaigns">
              <PlusIcon data-icon="inline-start" />
              New campaign
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatFrameCard
          label="Emails delivered"
          value={stats.delivered.toLocaleString()}
          subValue={`${stats.delivered7.toLocaleString()} this week`}
          trend={weekTrend(stats.delivered7, stats.deliveredPrev7)}
          icon={MailCheckIcon}
        />
        <StatFrameCard
          label="Open rate"
          value={`${stats.openRate}%`}
          subValue={`${stats.opensUnique.toLocaleString()} unique opens`}
          icon={MailOpenIcon}
        />
        <StatFrameCard
          label="Audience"
          value={stats.audience.toLocaleString()}
          subValue={`${stats.audienceNew7.toLocaleString()} new this week`}
          trend={weekTrend(stats.audienceNew7, stats.audiencePrev7)}
          icon={UsersIcon}
        />
        <StatFrameCard
          label="Campaigns sent"
          value={stats.campaignsSent.toLocaleString()}
          subValue={`${stats.campaignsSent7.toLocaleString()} this week`}
          trend={weekTrend(stats.campaignsSent7, stats.campaignsSentPrev7)}
          icon={SendIcon}
        />
      </div>

      {/* ── Sending domain ── */}
      <Card>
        <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <GlobeIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Sending from</p>
              <p className="truncate text-sm font-medium">{activeDomain}</p>
              <p className="truncate text-xs text-muted-foreground">
                {services.domainsVerified.length > 0
                  ? `${services.domainsVerified.length} verified domain${services.domainsVerified.length === 1 ? "" : "s"}`
                  : "Shared LetterStack newsletter domain"}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" asChild>
            <Link href="/dashboard/domains">
              <PlusIcon data-icon="inline-start" />
              Add your own domain
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* ── Charts ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Email activity"
          icon={TrendingUpIcon}
          action={<ChartCardLink href="/dashboard/analytics" />}
        >
          <div className="px-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Delivered and opened per day, last 14 days.
            </p>
          </div>
          <div className="p-4 pt-2">
            <EvilAreaChart
              config={emailActivityConfig}
              data={series}
              className="h-56 w-full"
              chartProps={{ margin: { left: -12, right: 8 } }}
            >
              <EvilAreaGrid strokeOpacity={0.35} />
              <EvilAreaXAxis
                dataKey="date"
                minTickGap={28}
                tickFormatter={(value: string) =>
                  new Date(value).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                  })
                }
              />
              <EvilAreaYAxis allowDecimals={false} width={40} />
              <EvilAreaTooltip />
              <EvilArea dataKey="delivered" />
              <EvilArea dataKey="opened" />
            </EvilAreaChart>
          </div>
        </ChartCard>

        <ChartCard
          title="Open rate by campaign"
          icon={BarChart3Icon}
          action={<ChartCardLink href="/dashboard/analytics" />}
        >
          <div className="px-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Unique opens over delivered, recent sends.
            </p>
          </div>
          <div className="p-4 pt-2">
            {openRateRings.length === 0 ? (
              <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                Send a campaign to see engagement here.
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="aspect-square h-56">
                  <EvilRadialChart
                    config={openRateRingConfig}
                    data={openRateRings}
                    nameKey="key"
                    className="h-full w-full"
                    innerRadius="30%"
                    outerRadius="100%"
                  >
                    {/* Pin the sweep to 0–100% so each ring fills to its real
                        open rate instead of scaling to the largest campaign. */}
                    <PolarAngleAxis
                      type="number"
                      domain={[0, 100]}
                      tick={false}
                      axisLine={false}
                    />
                    <EvilRadialBar dataKey="openRate" cornerRadius={6} />
                    <EvilRadialTooltip />
                    <EvilRadialLegend />
                  </EvilRadialChart>
                </div>
              </div>
            )}
          </div>
        </ChartCard>
      </div>

      {/* ── Recent campaigns ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Recent campaigns</CardTitle>
            <CardDescription>Your latest sends and drafts.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/campaigns">
              View all
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          {recentCampaigns.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No campaigns yet — create your first one to see activity here.
            </p>
          ) : (
            <div className="relative overflow-hidden rounded-b-xl">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Campaign</TableHead>
                    <TableHead className="hidden sm:table-cell">Recipients</TableHead>
                    <TableHead className="hidden md:table-cell">Open rate</TableHead>
                    <TableHead className="hidden lg:table-cell">Sent</TableHead>
                    <TableHead className="pr-6 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentCampaigns
                    .slice(0, RECENT_CAMPAIGNS_COLLAPSED_COUNT)
                    .map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell className="max-w-56 truncate pl-6 font-medium">
                        <span className="flex items-center gap-2">
                          <CampaignStatusIcon status={campaign.status} />
                          <span className="truncate">
                            {campaign.name || "Untitled campaign"}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="hidden tabular-nums text-muted-foreground sm:table-cell">
                        {campaign.audienceCount || "—"}
                      </TableCell>
                      <TableCell className="hidden tabular-nums text-muted-foreground md:table-cell">
                        {campaign.openRate !== null ? `${campaign.openRate}%` : "—"}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">
                        {shortDate(campaign.sentAt)}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/campaigns/${campaign.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {recentCampaigns.length > RECENT_CAMPAIGNS_COLLAPSED_COUNT && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-28 items-end justify-center bg-gradient-to-t from-card via-card/80 to-transparent pb-3 backdrop-blur-sm [mask-image:linear-gradient(to_top,black_60%,transparent)]">
                  <Button variant="outline" size="sm" className="pointer-events-auto" asChild>
                    <Link href="/dashboard/campaigns">See all campaigns</Link>
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Recent templates ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Recent templates</CardTitle>
            <CardDescription>Pick up where you left off.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/templates?tab=saved">
              View all
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentTemplates.length === 0 ? (
            <Empty className="border-0 py-10">
              <EmptyHeader>
                <EmptyMedia>
                  <IconStack aria-hidden="true" className="h-24 w-22">
                    <MailIcon className="size-5" />
                  </IconStack>
                </EmptyMedia>
                <EmptyTitle>No saved templates</EmptyTitle>
                <EmptyDescription>
                  Create a custom template in the editor, and click &quot;Save
                  as template&quot; to see it here!
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button size="sm" asChild>
                  <Link href="/editor">
                    <PlusIcon data-icon="inline-start" />
                    Create a template
                  </Link>
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {recentTemplates.map((template) => (
                <Link
                  key={template.id}
                  href={`/editor/template/${template.id}`}
                  className="group flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:border-muted-foreground/40 hover:bg-muted/30"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <PenLineIcon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {template.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      Edited {shortDate(template.updatedAt)}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Small "jump to the full analytics page" affordance in a chart card's corner.
function ChartCardLink({ href }: { href: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      asChild
      className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
    >
      <Link href={href}>
        View
        <ArrowUpRightIcon className="size-3" />
      </Link>
    </Button>
  );
}

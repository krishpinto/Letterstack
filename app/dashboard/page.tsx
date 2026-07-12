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
  GlobeIcon,
  MailCheckIcon,
  MailIcon,
  MailOpenIcon,
  MailPlusIcon,
  PenLineIcon,
  PlusIcon,
  SendIcon,
  SparklesIcon,
  TrendingUpIcon,
  UsersIcon,
  WorkflowIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { CampaignStatusIcon } from "@/components/campaign-status-icon";
import { CardContent } from "@/components/ui/card";
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
import {
  GettingStarted,
  type OnboardingStep,
} from "@/components/dashboard/getting-started";
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
  EvilRadarChart,
  Radar as EvilRadar,
  PolarGrid as EvilPolarGrid,
  PolarAngleAxis as EvilPolarAngleAxis,
  PolarRadiusAxis as EvilPolarRadiusAxis,
  Tooltip as EvilRadarTooltip,
} from "@/components/evilcharts/charts/radar-chart";
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
  formsTotal: number;
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

const openRateRadarConfig = {
  openRate: { label: "Open rate", colors: { light: ["#7c3aed"], dark: ["#a78bfa"] } },
} satisfies EvilChartConfig;

// Radar looks best as a polygon, so cap the perimeter at a handful of campaigns.
const MAX_RADAR_POINTS = 6;
// A radar needs at least a triangle to read as one; below this we show an
// empty radar web instead of a broken single spoke.
const MIN_RADAR_POINTS = 3;
// Six zero-value spokes so the empty state still draws a proper hexagon web.
const EMPTY_RADAR_DATA = Array.from({ length: 6 }, (_, i) => ({
  campaign: `_${i}`,
  openRate: 0,
}));

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
  const todayDate = new Date();
  const today = `Today, ${todayDate.getDate()} ${todayDate.toLocaleDateString(undefined, { month: "short" })}`;
  const activeDomain =
    services.domainsVerified[0] ?? services.defaultSendingDomain;

  // The onboarding guide. The required core path (audience → design → send) drives
  // the progress bar and is achievable on the shared domain; the optional group
  // walks new users through the rest of the app. All completion is derived from
  // live data. Required steps come first so the detail pane opens on the next one.
  const onboardingSteps: OnboardingStep[] = [
    {
      id: "account",
      title: "Create your workspace",
      done: true,
      heading: "Welcome to LetterStack",
      description:
        "Your workspace is ready. Work through these steps to send your first newsletter.",
      href: "/dashboard",
      cta: "Take a look around",
      icon: SparklesIcon,
    },
    {
      id: "audience",
      title: "Add your audience",
      done: stats.audience > 0,
      time: "2 min",
      heading: "Import your contacts",
      description:
        "Upload a CSV or Excel list — we validate, dedupe, and clean it as it comes in. This is who your campaigns go to.",
      href: "/dashboard/contacts",
      cta: "Add contacts",
      icon: UsersIcon,
    },
    {
      id: "template",
      // Satisfied by saving a template OR building any campaign — either counts
      // as "you've designed an email," so shared-domain users can finish it.
      title: "Design your first email",
      done: services.templatesTotal > 0 || services.campaignsTotal > 0,
      time: "10 min",
      heading: "Build an email in the editor",
      description:
        "Drag blocks onto the canvas to design a responsive, email-safe newsletter — or start from a ready-made template.",
      href: "/dashboard/templates",
      cta: "Open the editor",
      icon: PenLineIcon,
    },
    {
      id: "campaign",
      title: "Send your first campaign",
      done: stats.campaignsSent > 0,
      time: "5 min",
      heading: "Launch a campaign",
      description:
        "Pick your audience, choose a design, and send now or schedule it for later. You can start on our shared domain right away.",
      href: "/dashboard/campaigns",
      cta: "Create a campaign",
      icon: SendIcon,
    },
    {
      id: "domain",
      title: "Send from your own domain",
      done: services.domainsVerified.length > 0,
      optional: true,
      heading: "Use your own sending domain",
      description:
        "Authenticate a custom domain for the strongest deliverability and branding. Optional — the shared domain works out of the box.",
      href: "/dashboard/domains",
      cta: "Add a domain",
      icon: GlobeIcon,
    },
    {
      id: "forms",
      title: "Grow your list with a form",
      done: services.formsTotal > 0,
      optional: true,
      heading: "Add a signup form to your site",
      description:
        "Create an embeddable form so visitors can subscribe from anywhere — new signups flow straight into your audience.",
      href: "/dashboard/forms",
      cta: "Create a form",
      icon: MailPlusIcon,
    },
    {
      id: "automations",
      title: "Automate a welcome email",
      done: services.automationsTotal > 0,
      optional: true,
      heading: "Set up an automation",
      description:
        "Trigger emails automatically — like a welcome message the moment someone subscribes.",
      href: "/dashboard/automations",
      cta: "Build an automation",
      icon: WorkflowIcon,
    },
    {
      id: "analytics",
      title: "Track your results",
      done: stats.campaignsSent > 0,
      optional: true,
      heading: "See how your campaigns perform",
      description:
        "Delivery, opens, clicks, bounces and complaints per campaign — everything you need to keep your sending healthy.",
      href: "/dashboard/analytics",
      cta: "Open analytics",
      icon: BarChart3Icon,
    },
  ];
  // Each campaign with a known open rate becomes one point on the radar's
  // perimeter (labelled by name), and open rate is the single series polygon.
  const openRateRadar = recentCampaigns
    .filter((c) => c.openRate !== null)
    .slice(0, MAX_RADAR_POINTS)
    .map((c) => {
      const name = c.name || "Untitled";
      return {
        campaign: name.length > 12 ? `${name.slice(0, 12)}…` : name,
        openRate: c.openRate as number,
      };
    });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {/* ── Welcome header ── */}
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Welcome back, {firstName}! 👋
          </h1>
          <p className="mt-1.5 text-sm sm:text-base text-muted-foreground font-medium">
            Here&apos;s how your newsletters are doing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-muted-foreground/80 py-1.5 px-2">
            {today}
          </span>
          <Button asChild>
            <Link href="/dashboard/campaigns">
              <PlusIcon data-icon="inline-start" />
              New Email
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Getting started (hides once set up, or when dismissed) ── */}
      <GettingStarted userName={firstName} steps={onboardingSteps} />

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
            {openRateRadar.length >= MIN_RADAR_POINTS ? (
              <div className="flex justify-center">
                <div className="aspect-square h-56">
                  <EvilRadarChart
                    config={openRateRadarConfig}
                    data={openRateRadar}
                    className="h-full w-full"
                    chartProps={{ outerRadius: "68%" }}
                  >
                    <EvilPolarGrid />
                    <EvilPolarAngleAxis dataKey="campaign" />
                    {/* Fixed 0–100% scale so the polygon reflects real open
                        rates rather than auto-scaling to the largest one. */}
                    <EvilPolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    <EvilRadar dataKey="openRate" variant="filled" />
                    <EvilRadarTooltip />
                  </EvilRadarChart>
                </div>
              </div>
            ) : (
              // Too few campaigns to form a radar — draw an empty web so the
              // card still looks intentional, with a caption over it.
              <div className="relative flex justify-center">
                <div className="aspect-square h-56 opacity-50">
                  <EvilRadarChart
                    config={openRateRadarConfig}
                    data={EMPTY_RADAR_DATA}
                    className="h-full w-full"
                    chartProps={{ outerRadius: "68%" }}
                  >
                    <EvilPolarGrid />
                    <EvilPolarAngleAxis dataKey="campaign" tick={false} />
                    <EvilPolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  </EvilRadarChart>
                </div>
                <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
                  {openRateRadar.length === 0
                    ? "Send a campaign to see engagement here."
                    : "Send a few campaigns to compare open rates here."}
                </p>
              </div>
            )}
          </div>
        </ChartCard>
      </div>

      {/* ── Recent campaigns ── */}
      <div className="overflow-hidden rounded-[1.375rem] border border-border bg-muted p-1 pt-0 gap-0 flex flex-col">
        {/* Top Strip (bg-muted) */}
        <div className="flex items-center justify-between gap-1 px-3 py-1.5">
          <span className="flex items-center gap-1">
            <SendIcon className="size-3 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm text-muted-foreground font-semibold">Campaign Activity</span>
          </span>
          <Button variant="ghost" size="sm" asChild className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground">
            <Link href="/dashboard/campaigns">
              View all
              <ArrowRightIcon className="size-3" data-icon="inline-end" />
            </Link>
          </Button>
        </div>

        {/* Inner Card (bg-card) */}
        <div className="overflow-hidden rounded-[1.125rem] border border-border bg-card">
          <CardContent className="px-0 pt-2">
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
        </div>
      </div>

      {/* ── Recent templates (70%) + sending domain (30%) ── */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        {/* Recent templates */}
        <div className="overflow-hidden rounded-[1.375rem] border border-border bg-muted p-1 pt-0 gap-0 flex flex-col">
          {/* Top Strip (bg-muted) */}
          <div className="flex items-center justify-between gap-1 px-3 py-1.5">
            <span className="flex items-center gap-1">
              <PenLineIcon className="size-3 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm text-muted-foreground font-semibold">Design templates</span>
            </span>
            <Button variant="ghost" size="sm" asChild className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground">
              <Link href="/dashboard/templates?tab=saved">
                View all
                <ArrowRightIcon className="size-3" data-icon="inline-end" />
              </Link>
            </Button>
          </div>

          {/* Inner Card (bg-card) */}
          <div className="overflow-hidden rounded-[1.125rem] border border-border bg-card flex-1 flex flex-col">
            <CardContent className="flex-1 flex flex-col justify-center p-4">
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
              <div className="grid gap-3 sm:grid-cols-2">
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
          </div>
        </div>

        {/* Sending domain */}
        <div className="overflow-hidden rounded-[1.375rem] border border-border bg-muted p-1 pt-0 gap-0 flex flex-col">
          {/* Top Strip (bg-muted) */}
          <div className="flex items-center justify-between gap-1 px-3 py-1.5">
            <span className="flex items-center gap-1">
              <GlobeIcon className="size-3 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm text-muted-foreground font-semibold">Verified domains</span>
            </span>
          </div>

          {/* Inner Card (bg-card) */}
          <div className="overflow-hidden rounded-[1.125rem] border border-border bg-card flex-1 flex flex-col">
            <CardContent className="flex flex-1 flex-col justify-center items-center text-center p-4">
              {services.domainsVerified.length === 0 ? (
                <Empty className="border-0 py-4 gap-2">
                  <EmptyHeader>
                    <EmptyMedia>
                      <IconStack aria-hidden="true" className="h-24 w-22">
                        <GlobeIcon className="size-5" />
                      </IconStack>
                    </EmptyMedia>
                    <EmptyTitle>No verified domains</EmptyTitle>
                    <EmptyDescription>
                      Configure a custom domain to send emails from your own brand.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button size="sm" asChild>
                      <Link href="/dashboard/domains">
                        <PlusIcon data-icon="inline-start" />
                        Add a domain
                      </Link>
                    </Button>
                  </EmptyContent>
                </Empty>
              ) : (
                <div className="flex flex-col items-center justify-center text-center gap-3.5 py-2">
                  <IconStack aria-hidden="true" className="h-24 w-22">
                    <GlobeIcon className="size-5 text-primary" />
                  </IconStack>
                  <div className="space-y-1">
                    <p className="font-semibold text-sm text-foreground">{activeDomain}</p>
                    <p className="text-xs text-emerald-500 font-medium flex items-center justify-center gap-1">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Verified & Active
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="w-fit px-4 shadow-xs mt-1" asChild>
                    <Link href="/dashboard/domains">
                      Manage Domain
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </div>
        </div>
      </div>
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

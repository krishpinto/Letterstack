"use client";

// Workspace dashboard: headline stats with week-over-week movement, recent
// campaign activity, delivery/open charts, and recent templates. Full-bleed —
// the shell hides both sidebars on this route.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowRightIcon,
  CalendarIcon,
  MailCheckIcon,
  MailOpenIcon,
  PenLineIcon,
  PlusIcon,
  SendIcon,
  UsersIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
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

type DashboardData = {
  stats: Stats;
  series: SeriesPoint[];
  recentCampaigns: RecentCampaign[];
  recentTemplates: RecentTemplate[];
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

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  sent: "default",
  sending: "outline",
  scheduled: "outline",
  draft: "secondary",
};

const chartConfig = {
  delivered: { label: "Delivered", color: "var(--chart-1)" },
  opened: { label: "Opened", color: "var(--chart-2)" },
  openRate: { label: "Open rate", color: "var(--chart-1)" },
} satisfies ChartConfig;

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

  const { stats, series, recentCampaigns, recentTemplates } = data;
  const firstName = (session?.user?.name ?? "there").split(/\s+/)[0];
  const today = new Date().toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const openRateBars = recentCampaigns
    .filter((c) => c.openRate !== null)
    .slice(0, 6)
    .map((c) => ({
      name: c.name.length > 14 ? `${c.name.slice(0, 14)}…` : c.name,
      openRate: c.openRate,
    }));

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
          trend={weekTrend(stats.audienceNew7, stats.audiencePrev7)}
          icon={UsersIcon}
        />
        <StatFrameCard
          label="Campaigns sent"
          value={stats.campaignsSent.toLocaleString()}
          trend={weekTrend(stats.campaignsSent7, stats.campaignsSentPrev7)}
          icon={SendIcon}
        />
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
        <CardContent>
          {recentCampaigns.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No campaigns yet — create your first one to see activity here.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Recipients</TableHead>
                  <TableHead className="hidden md:table-cell">Open rate</TableHead>
                  <TableHead className="hidden lg:table-cell">Sent</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCampaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="max-w-56 truncate font-medium">
                      {campaign.name || "Untitled campaign"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[campaign.status] ?? "secondary"}>
                        {campaign.status}
                      </Badge>
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
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/campaigns/${campaign.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Charts ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Email activity</CardTitle>
            <CardDescription>
              Delivered and opened per day, last 14 days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-56 w-full">
              <AreaChart data={series} margin={{ left: -12, right: 8 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.35} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={28}
                  tickFormatter={(value: string) =>
                    new Date(value).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                    })
                  }
                />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  dataKey="delivered"
                  type="monotone"
                  fill="var(--color-delivered)"
                  fillOpacity={0.18}
                  stroke="var(--color-delivered)"
                  strokeWidth={2}
                />
                <Area
                  dataKey="opened"
                  type="monotone"
                  fill="var(--color-opened)"
                  fillOpacity={0.18}
                  stroke="var(--color-opened)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open rate by campaign</CardTitle>
            <CardDescription>Unique opens over delivered, recent sends.</CardDescription>
          </CardHeader>
          <CardContent>
            {openRateBars.length === 0 ? (
              <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                Send a campaign to see engagement here.
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-56 w-full">
                <BarChart data={openRateBars} margin={{ left: -12, right: 8 }}>
                  <CartesianGrid vertical={false} strokeOpacity={0.35} />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    tickFormatter={(value: number) => `${value}%`}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="openRate"
                    fill="var(--color-openRate)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={44}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

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
            <p className="py-6 text-center text-sm text-muted-foreground">
              No saved templates yet — design one in the editor and save it.
            </p>
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

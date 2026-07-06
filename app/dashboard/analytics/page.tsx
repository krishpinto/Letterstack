"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  BarChart3Icon,
  CalendarIcon,
  MailIcon,
  AreaChart,
  Percent,
  MousePointerClick,
  Filter,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ChartCard } from "@/components/ui/chart-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { IconStack } from "@/components/reui/icon-stack";
import { PageLoader } from "@/components/bar-spinner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { onOrganizationChanged } from "@/lib/dashboard-events";
import { cn } from "@/lib/utils";
import {
  EvilAreaChart,
  Area,
  XAxis,
  YAxis,
  Grid,
  Tooltip,
  Legend,
  Dot,
  ActiveDot,
} from "@/components/evilcharts/charts/area-chart";
import { type ChartConfig } from "@/components/evilcharts/ui/chart";
import { ReferenceLine } from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

type Engagement = {
  delivered: number;
  bounced: number;
  complained: number;
  opensTotal: number;
  opensUnique: number;
  clicksTotal: number;
  clicksUnique: number;
};

type Row = {
  id: string;
  name: string;
  subject: string;
  status: string;
  sentAt: string | null;
  audienceCount: number;
  sentCount: number;
  engagement: Engagement;
};

type DateFilter = "7d" | "30d" | "90d" | "6m" | "1y" | "all";

type OverviewDataKey =
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(part: number, whole: number, decimals = 1) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100 * 10 ** decimals) / 10 ** decimals;
}

function formatDate(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const DAY_MS = 86_400_000;
const DAYS_BY_FILTER: Record<Exclude<DateFilter, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "6m": 180,
  "1y": 365,
};

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return [year, month, day].join("-");
}

function formatXDate(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function rangeStartForFilter(filter: DateFilter) {
  if (filter === "all") return null;
  const today = startOfLocalDay(new Date());
  return new Date(today.getTime() - (DAYS_BY_FILTER[filter] - 1) * DAY_MS);
}

function filterByDate(rows: Row[], filter: DateFilter): Row[] {
  const start = rangeStartForFilter(filter);
  if (!start) return rows;
  const end = new Date(startOfLocalDay(new Date()).getTime() + DAY_MS);

  return rows.filter((row) => {
    if (!row.sentAt) return false;
    const sentAt = new Date(row.sentAt);
    return sentAt >= start && sentAt < end;
  });
}

const DATE_LABELS: Record<DateFilter, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "6m": "Last 6 months",
  "1y": "Last year",
  all: "All time",
};

const OVERVIEW_SERIES: { key: OverviewDataKey; label: string }[] = [
  { key: "delivered", label: "Delivered" },
  { key: "opened", label: "Opened" },
  { key: "clicked", label: "Clicked" },
  { key: "bounced", label: "Bounced" },
  { key: "complained", label: "Complained" },
];

const SERIES_COLORS: Record<OverviewDataKey, string> = {
  delivered: "bg-[#0284c7] dark:bg-[#38bdf8]",
  opened: "bg-[#059669] dark:bg-[#34d399]",
  clicked: "bg-[#7c3aed] dark:bg-[#a78bfa]",
  bounced: "bg-[#dc2626] dark:bg-[#f87171]",
  complained: "bg-[#d97706] dark:bg-[#fbbf24]",
};

const overviewChartConfig = {
  delivered: {
    label: "Delivered",
    colors: { light: ["#0284c7"], dark: ["#38bdf8"] },
  },
  opened: {
    label: "Opened",
    colors: { light: ["#059669"], dark: ["#34d399"] },
  },
  clicked: {
    label: "Clicked",
    colors: { light: ["#7c3aed"], dark: ["#a78bfa"] },
  },
  bounced: {
    label: "Bounced",
    colors: { light: ["#dc2626"], dark: ["#f87171"] },
  },
  complained: {
    label: "Complained",
    colors: { light: ["#d97706"], dark: ["#fbbf24"] },
  },
} satisfies ChartConfig;

const bounceChartConfig = {
  bounceRate: {
    label: "Bounce Rate",
    colors: { light: ["#dc2626"], dark: ["#f87171"] },
  },
} satisfies ChartConfig;

const clickChartConfig = {
  clickRate: {
    label: "Click Rate",
    colors: { light: ["#7c3aed"], dark: ["#a78bfa"] },
  },
} satisfies ChartConfig;

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>("7d");
  const [visibleSeries, setVisibleSeries] = useState<Set<OverviewDataKey>>(
    new Set(OVERVIEW_SERIES.map((s) => s.key)),
  );

  const loadAnalytics = useCallback(async () => {
    setRows(null);
    try {
      const response = await fetch("/api/analytics");
      const data = await response.json();
      setRows(data.ok ? data.campaigns : []);
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    return onOrganizationChanged(() => {
      void loadAnalytics();
    });
  }, [loadAnalytics]);

  // ── Derived data ────────────────────────────────────────────────────────────

  const filteredRows = useMemo(
    () => filterByDate(rows ?? [], dateFilter),
    [rows, dateFilter],
  );

  type OverviewPoint = {
    key: string;
    date: string;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    complained: number;
  };

  const overviewData = useMemo<OverviewPoint[]>(() => {
    const buckets = new Map<string, OverviewPoint>();
    const ensureBucket = (key: string) => {
      const existing = buckets.get(key);
      if (existing) return existing;
      const bucket = {
        key,
        date: formatXDate(key),
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        complained: 0,
      };
      buckets.set(key, bucket);
      return bucket;
    };

    const rangeStart = rangeStartForFilter(dateFilter);
    if (rangeStart) {
      const days = DAYS_BY_FILTER[dateFilter as Exclude<DateFilter, "all">];
      for (let i = 0; i < days; i += 1) {
        ensureBucket(dateKey(new Date(rangeStart.getTime() + i * DAY_MS)));
      }
    }

    filteredRows.forEach((row) => {
      if (!row.sentAt) return;
      const bucket = ensureBucket(dateKey(new Date(row.sentAt)));
      bucket.sent += row.sentCount;
      bucket.delivered += row.engagement.delivered;
      bucket.opened += row.engagement.opensUnique;
      bucket.clicked += row.engagement.clicksUnique;
      bucket.bounced += row.engagement.bounced;
      bucket.complained += row.engagement.complained;
    });

    return Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [filteredRows, dateFilter]);

  type RatePoint = { key: string; date: string; bounceRate: number };
  const bounceData = useMemo<RatePoint[]>(
    () =>
      overviewData.map((point) => ({
        key: point.key,
        date: point.date,
        bounceRate: pct(point.bounced, point.delivered),
      })),
    [overviewData],
  );

  type ClickRatePoint = { key: string; date: string; clickRate: number };
  const clickData = useMemo<ClickRatePoint[]>(
    () =>
      overviewData.map((point) => ({
        key: point.key,
        date: point.date,
        clickRate: pct(point.clicked, point.sent),
      })),
    [overviewData],
  );

  // Totals for stats badges
  const totals = useMemo(() => {
    const t = {
      sent: 0,
      delivered: 0,
      opensUnique: 0,
      clicksUnique: 0,
      bounced: 0,
    };
    filteredRows.forEach((r) => {
      t.sent += r.sentCount;
      t.delivered += r.engagement.delivered;
      t.opensUnique += r.engagement.opensUnique;
      t.clicksUnique += r.engagement.clicksUnique;
      t.bounced += r.engagement.bounced;
    });
    return t;
  }, [filteredRows]);

  const deliveryRate = pct(totals.delivered, totals.sent);

  const isLoading = rows === null;

  // ── Toggle series ────────────────────────────────────────────────────────────

  function toggleSeries(key: OverviewDataKey) {
    setVisibleSeries((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return prev; // keep at least one
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* ── Chart 1: Overview ────────────────────────────────────────────── */}
      <ChartCard
        title="Overall"
        icon={AreaChart}
        header={(
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            {/* Left: KPIs */}
            <div className="flex gap-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Emails Sent
                </p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-8 w-16" />
                ) : (
                  <p className="mt-1 text-3xl font-bold tabular-nums leading-none">
                    {totals.sent.toLocaleString()}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Delivery Rate
                </p>
                {isLoading ? (
                  <Skeleton className="mt-1 h-8 w-16" />
                ) : (
                  <p className="mt-1 text-3xl font-bold tabular-nums leading-none">
                    {deliveryRate}%
                  </p>
                )}
              </div>
            </div>

            {/* Right: filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Series filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon-xs" title="Filter Events" aria-label="Filter Events">
                    <Filter className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel>Show series</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {OVERVIEW_SERIES.map((s) => (
                    <DropdownMenuCheckboxItem
                      key={s.key}
                      checked={visibleSeries.has(s.key)}
                      onCheckedChange={() => toggleSeries(s.key)}
                    >
                      <span className="flex items-center gap-2">
                        <span className={cn("size-2 rounded-full", SERIES_COLORS[s.key])} />
                        {s.label}
                      </span>
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Date filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="xs">
                    <CalendarIcon className="size-3" data-icon="inline-start" />
                    {DATE_LABELS[dateFilter]}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuLabel>Time range</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {(Object.keys(DATE_LABELS) as DateFilter[]).map((k) => (
                    <DropdownMenuCheckboxItem
                      key={k}
                      checked={dateFilter === k}
                      onCheckedChange={() => setDateFilter(k)}
                    >
                      {DATE_LABELS[k]}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
      >
          <div className="relative">
            <EvilAreaChart
              data={overviewData}
              config={overviewChartConfig}
              className="h-72 w-full px-4 pb-2"
              xDataKey="date"
              isLoading={isLoading}
              showBrush
              brushFormatLabel={(value) => String(value)}
            >
              <Grid />
              <XAxis dataKey="date" />
              <Tooltip variant="default" roundness="lg" />
              <Legend isClickable />
              {visibleSeries.has("delivered") && (
                <Area dataKey="delivered" variant="gradient" isClickable>
                  <Dot variant="border" />
                  <ActiveDot variant="colored-border" />
                </Area>
              )}
              {visibleSeries.has("opened") && (
                <Area dataKey="opened" variant="gradient" isClickable>
                  <Dot variant="border" />
                  <ActiveDot variant="colored-border" />
                </Area>
              )}
              {visibleSeries.has("clicked") && (
                <Area dataKey="clicked" variant="gradient" isClickable>
                  <Dot variant="border" />
                  <ActiveDot variant="colored-border" />
                </Area>
              )}
              {visibleSeries.has("bounced") && (
                <Area dataKey="bounced" variant="gradient" isClickable>
                  <Dot variant="border" />
                  <ActiveDot variant="colored-border" />
                </Area>
              )}
              {visibleSeries.has("complained") && (
                <Area dataKey="complained" variant="gradient" isClickable>
                  <Dot variant="border" />
                  <ActiveDot variant="colored-border" />
                </Area>
              )}
            </EvilAreaChart>
            {!isLoading && overviewData.length < 2 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-xs text-muted-foreground">
                  <BarChart3Icon className="size-3" />
                  Not enough data available
                </Badge>
              </div>
            )}
          </div>
      </ChartCard>

      {/* ── Charts 2 & 3 ─────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Bounce Rate */}
        <ChartCard
          title="Bounce Rate"
          icon={Percent}
          header={(
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardDescription className="text-xs font-medium uppercase tracking-wider">
                  Bounce Rate
                </CardDescription>
                {isLoading ? (
                  <Skeleton className="mt-1 h-8 w-16" />
                ) : (
                  <CardTitle className="mt-1 text-3xl font-bold tabular-nums leading-none">
                    {pct(totals.bounced, totals.delivered)}%
                  </CardTitle>
                )}
              </div>
            </div>
          )}
        >
            <div className="relative">
              <EvilAreaChart
                data={bounceData}
                config={bounceChartConfig}
                className="h-52 w-full px-2 pb-2"
                xDataKey="date"
                isLoading={isLoading}
              >
                <Grid />
                <XAxis dataKey="date" />
                {/* Fixed domain so 5% and 10% lines are always visible */}
                <YAxis domain={[0, 15]} tickFormatter={(v) => `${v}%`} />
                <Tooltip variant="default" roundness="lg" />
                {/* SES warning threshold — only when not loading */}
                {!isLoading && (
                  <ReferenceLine
                    y={5}
                    stroke="#f97316"
                    strokeDasharray="5 3"
                    strokeWidth={1.2}
                    label={{
                      value: "WARN 5%",
                      position: "insideBottomLeft",
                      fill: "#f97316",
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  />
                )}
                {/* SES ban / suspension threshold — only when not loading */}
                {!isLoading && (
                  <ReferenceLine
                    y={10}
                    stroke="#ef4444"
                    strokeDasharray="5 3"
                    strokeWidth={1.2}
                    label={{
                      value: "BAN RISK 10%",
                      position: "insideBottomLeft",
                      fill: "#ef4444",
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  />
                )}
                <Area dataKey="bounceRate" variant="gradient">
                  <Dot variant="border" />
                  <ActiveDot variant="colored-border" />
                </Area>
              </EvilAreaChart>
              {!isLoading && bounceData.length < 2 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-xs text-muted-foreground">
                    <BarChart3Icon className="size-3" />
                    Not enough data available
                  </Badge>
                </div>
              )}
            </div>
            {/* Breakdown legend */}
            {!isLoading && (() => {
              const bounceRate = pct(totals.bounced, totals.delivered);
              const isBanRisk = bounceRate >= 10;
              const isWarning = bounceRate >= 5 && !isBanRisk;
              return (
                <div className="border-t px-5 py-3">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className="size-2 rounded-full bg-destructive" />
                      Total bounced
                    </span>
                    <span className="flex items-center gap-2 tabular-nums font-medium">
                      {isBanRisk && (
                        <Badge
                          variant="outline"
                          className="border-red-500/40 bg-red-500/10 text-[10px] font-semibold text-red-500 px-1.5 py-0.5"
                        >
                          BAN RISK
                        </Badge>
                      )}
                      {isWarning && (
                        <Badge
                          variant="outline"
                          className="border-orange-500/40 bg-orange-500/10 text-[10px] font-semibold text-orange-500 px-1.5 py-0.5"
                        >
                          WARN
                        </Badge>
                      )}
                      {totals.bounced}{" "}
                      <span className={cn(
                        "text-muted-foreground",
                        isBanRisk && "text-red-500",
                        isWarning && "text-orange-500",
                      )}>
                        {bounceRate}%
                      </span>
                    </span>
                  </div>
                </div>
              );
            })()}
        </ChartCard>

        {/* Avg Click Rate */}
        <ChartCard
          title="Avg. Click Rate"
          icon={MousePointerClick}
          header={(
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardDescription className="text-xs font-medium uppercase tracking-wider">
                  Avg. Click Rate
                </CardDescription>
                {isLoading ? (
                  <Skeleton className="mt-1 h-8 w-16" />
                ) : (
                  <CardTitle className="mt-1 text-3xl font-bold tabular-nums leading-none">
                    {pct(totals.clicksUnique, totals.sent)}%
                  </CardTitle>
                )}
              </div>
            </div>
          )}
        >
            <div className="relative">
              <EvilAreaChart
                data={clickData}
                config={clickChartConfig}
                className="h-52 w-full px-4 pb-2"
                xDataKey="date"
                isLoading={isLoading}
              >
                <Grid />
                <XAxis dataKey="date" />
                <Tooltip variant="default" roundness="lg" />
                <Area dataKey="clickRate" variant="gradient">
                  <Dot variant="border" />
                  <ActiveDot variant="colored-border" />
                </Area>
              </EvilAreaChart>
              {!isLoading && clickData.length < 2 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-xs text-muted-foreground">
                    <BarChart3Icon className="size-3" />
                    Not enough data available
                  </Badge>
                </div>
              )}
            </div>
            {/* Breakdown legend */}
            {!isLoading && (
              <div className="border-t px-5 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="size-2 rounded-full bg-[#7c3aed] dark:bg-[#a78bfa]" />
                    Unique clicks
                  </span>
                  <span className="tabular-nums font-medium">
                    {totals.clicksUnique}{" "}
                    <span className="text-muted-foreground">
                      {pct(totals.clicksUnique, totals.sent)}%
                    </span>
                  </span>
                </div>
              </div>
            )}
        </ChartCard>
      </div>

      {/* ── Campaign Table ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign performance</CardTitle>
          <CardDescription>
            Per-campaign delivery and engagement numbers from sent campaigns.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Opens</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="hidden text-right md:table-cell">
                    Bounced
                  </TableHead>
                  <TableHead className="hidden text-right lg:table-cell">
                    Date
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Skeleton className="size-9 rounded-lg" />
                          <div className="flex flex-col gap-1">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                        </div>
                      </TableCell>
                      {[...Array(5)].map((_, j) => (
                        <TableCell key={j} className="text-right">
                          <Skeleton className="ml-auto h-4 w-10" />
                        </TableCell>
                      ))}
                      <TableCell />
                    </TableRow>
                  ))
                ) : filteredRows.length > 0 ? (
                  filteredRows.map((row) => {
                    const openRate = pct(
                      row.engagement.opensUnique,
                      row.sentCount,
                    );
                    const clickRate = pct(
                      row.engagement.clicksUnique,
                      row.sentCount,
                    );

                    return (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer"
                        onClick={() =>
                          router.push(`/dashboard/campaigns/${row.id}`)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            router.push(`/dashboard/campaigns/${row.id}`);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <TableCell className="min-w-64">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                              <MailIcon className="size-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-foreground">
                                {row.name}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {row.subject}
                              </span>
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {row.sentCount}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="block tabular-nums">
                            {openRate}%
                          </span>
                          <span className="block text-xs tabular-nums text-muted-foreground">
                            {row.engagement.opensUnique}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="block tabular-nums">
                            {clickRate}%
                          </span>
                          <span className="block text-xs tabular-nums text-muted-foreground">
                            {row.engagement.clicksUnique}
                          </span>
                        </TableCell>
                        <TableCell
                          className={cn(
                            "hidden text-right tabular-nums md:table-cell",
                            row.engagement.bounced > 0
                              ? "text-destructive"
                              : "text-muted-foreground",
                          )}
                        >
                          {row.engagement.bounced}
                        </TableCell>
                        <TableCell className="hidden text-right text-muted-foreground lg:table-cell">
                          {formatDate(row.sentAt)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          <ArrowRightIcon className="ml-auto size-4" />
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Empty className="border-0 py-14">
                        <EmptyHeader>
                          <EmptyMedia>
                            <IconStack aria-hidden="true" className="h-24 w-22">
                              <BarChart3Icon className="size-5" />
                            </IconStack>
                          </EmptyMedia>
                          <EmptyTitle>No campaigns sent yet</EmptyTitle>
                          <EmptyDescription>
                            Once you send a campaign, delivery and engagement
                            metrics will show up here.
                          </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                          <Button asChild>
                            <Link href="/dashboard/campaigns">
                              Go to campaigns
                            </Link>
                          </Button>
                        </EmptyContent>
                      </Empty>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, BarChart3Icon, MailIcon } from "lucide-react";

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
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { BarSpinner } from "@/components/bar-spinner";
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

type MetricTone = "default" | "primary" | "muted" | "destructive";

function pct(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

function formatDate(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);

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

  const totals = useMemo(() => {
    const total = { sent: 0, opensUnique: 0, clicksUnique: 0, bounced: 0 };
    (rows ?? []).forEach((row) => {
      total.sent += row.sentCount;
      total.opensUnique += row.engagement.opensUnique;
      total.clicksUnique += row.engagement.clicksUnique;
      total.bounced += row.engagement.bounced;
    });
    return total;
  }, [rows]);

  if (rows === null) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
        <BarSpinner size={18} />
        Loading analytics...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Analytics</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Delivery is exact. Opens and clicks are estimates because some inboxes
          block or pre-fetch tracking.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Emails delivered" value={totals.sent} />
        <Metric
          label="Avg. open rate"
          value={`${pct(totals.opensUnique, totals.sent)}%`}
          tone="primary"
          soft
        />
        <Metric
          label="Avg. click rate"
          value={`${pct(totals.clicksUnique, totals.sent)}%`}
          tone="primary"
          soft
        />
        <Metric
          label="Bounced"
          value={totals.bounced}
          tone={totals.bounced > 0 ? "destructive" : "muted"}
        />
      </div>

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
                {rows.length > 0 ? (
                  rows.map((row) => {
                    const openRate = pct(row.engagement.opensUnique, row.sentCount);
                    const clickRate = pct(row.engagement.clicksUnique, row.sentCount);

                    return (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/dashboard/campaigns/${row.id}`)}
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
                            <span className="block tabular-nums">{openRate}%</span>
                            <span className="block text-xs tabular-nums text-muted-foreground">
                              {row.engagement.opensUnique}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="block tabular-nums">{clickRate}%</span>
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
                          <EmptyMedia variant="icon">
                            <BarChart3Icon />
                          </EmptyMedia>
                          <EmptyTitle>No campaigns sent yet</EmptyTitle>
                          <EmptyDescription>
                            Once you send a campaign, delivery and engagement
                            metrics will show up here.
                          </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                          <Button asChild>
                            <Link href="/dashboard/campaigns">Go to campaigns</Link>
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

function Metric({
  label,
  value,
  tone = "default",
  soft,
}: {
  label: string;
  value: number | string;
  tone?: MetricTone;
  soft?: boolean;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-2">
        <div
          className={cn(
            "text-2xl font-semibold leading-none tabular-nums",
            tone === "primary" && "text-primary",
            tone === "muted" && "text-muted-foreground",
            tone === "destructive" && "text-destructive",
          )}
        >
          {value}
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          {label}
          {soft && <Badge variant="outline">est</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}

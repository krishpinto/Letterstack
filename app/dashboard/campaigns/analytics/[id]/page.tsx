"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeftIcon, SearchIcon, UserRoundIcon } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { PageLoader } from "@/components/bar-spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProgressState = {
  total: number;
  sent: number;
  failed: number;
  pending: number;
};

type Campaign = {
  id: string;
  name: string;
  subject: string;
  status: string;
  fromName: string;
  fromEmail: string;
};

type Recipient = {
  id: string;
  email: string;
  name: string | null;
  sentAt: string | null;
  status: string;
  error: string | null;
};

type Engagement = {
  delivered: number;
  bounced: number;
  complained: number;
  opensTotal: number;
  opensUnique: number;
  clicksTotal: number;
  clicksUnique: number;
  unsubscribed: number;
};

type StatusKey = "all" | "sent" | "failed" | "bounced" | "pending";
type MetricTone = "default" | "primary" | "muted" | "destructive";

const STATUS_LABELS: Record<StatusKey, string> = {
  all: "All",
  sent: "Sent",
  failed: "Failed",
  bounced: "Bounced",
  pending: "Sending",
};

const STATUS_BADGE_VARIANTS = {
  sent: "default",
  failed: "destructive",
  bounced: "destructive",
  pending: "outline",
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string | null, email: string) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return (parts[0]?.[0] + (parts[1]?.[0] || "")).toUpperCase();
  }
  return email[0]?.toUpperCase() ?? "?";
}

function formatSentAt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CampaignAnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  const [notFound, setNotFound] = useState(false);
  const campaignRef = useRef<Campaign | null>(null);

  // Fetch + poll
  useEffect(() => {
    if (!id) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const [progressRes, recipientsRes, engagementRes] = await Promise.all([
          fetch(`/api/campaigns/${id}/progress`).then((r) => r.json()),
          fetch(`/api/campaigns/${id}/recipients`).then((r) => r.json()),
          fetch(`/api/campaigns/${id}/analytics`).then((r) => r.json()),
        ]);

        if (!alive) return;

        if (!progressRes.ok) {
          setNotFound(true);
          return;
        }

        const merged = {
          ...(campaignRef.current ?? {}),
          ...progressRes.campaign,
        } as Campaign;
        campaignRef.current = merged;
        setCampaign(merged);
        setProgress(progressRes.progress);
        if (recipientsRes.ok) setRecipients(recipientsRes.recipients);
        if (engagementRes.ok) setEngagement(engagementRes.engagement);

        // Keep polling while batches are still in flight
        if (
          progressRes.progress.pending > 0 ||
          progressRes.progress.total === 0
        ) {
          timer = setTimeout(poll, 1500);
        }
      } catch {
        // silently retry on next scheduled poll
      }
    }

    poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [id]);

  // ─── Derived ───────────────────────────────────────────────────────────────

  const counts = useMemo(() => {
    const count: Record<StatusKey, number> = {
      all: recipients.length,
      sent: 0,
      failed: 0,
      bounced: 0,
      pending: 0,
    };
    recipients.forEach((r) => {
      if (r.status in count) count[r.status as StatusKey]++;
    });
    return count;
  }, [recipients]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipients.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q && !`${r.name ?? ""} ${r.email}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [recipients, query, statusFilter]);

  // ─── States ────────────────────────────────────────────────────────────────

  if (notFound) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Campaign not found.
      </div>
    );
  }

  if (!campaign || !progress) {
    return (
      <PageLoader label="Loading analytics…" />
    );
  }

  const total = progress.total;
  const done = progress.sent + progress.failed;
  const finished = total > 0 && progress.pending === 0;
  const deliveryRate =
    total > 0 ? Math.round((counts.sent / total) * 100) : 0;
  const progressPercent =
    total > 0 ? Math.round((done / total) * 100) : 0;
  const rate = (part: number) =>
    counts.sent > 0 ? Math.round((part / counts.sent) * 100) : 0;
  const openRate = rate(engagement?.opensUnique ?? 0);
  const clickRate = rate(engagement?.clicksUnique ?? 0);
  const unsubscribed = engagement?.unsubscribed ?? 0;
  const complained = engagement?.complained ?? 0;
  const unsubscribeRate =
    counts.sent > 0 ? ((unsubscribed / counts.sent) * 100).toFixed(1) : "0.0";
  const complaintRate =
    counts.sent > 0 ? ((complained / counts.sent) * 100).toFixed(2) : "0.00";
  // Click-to-open: of the people who opened, how many clicked. A far better
  // content-quality signal than raw click rate.
  const clickToOpenRate =
    (engagement?.opensUnique ?? 0) > 0
      ? Math.round(
          ((engagement?.clicksUnique ?? 0) / (engagement?.opensUnique ?? 1)) * 100,
        )
      : 0;

  const filterKeys = (
    ["all", "sent", "failed", "bounced", "pending"] as StatusKey[]
  ).filter((k) => k === "all" || counts[k] > 0);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" asChild className="w-fit">
          <Link href={`/dashboard/campaigns/${id}`}>
            <ArrowLeftIcon data-icon="inline-start" />
            Back to campaign
          </Link>
        </Button>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-normal">
              {campaign.name}
            </h1>
            <Badge variant={finished ? "default" : "outline"}>
              <span
                className={cn(
                  "size-1.5 rounded-full bg-current",
                  !finished && "animate-pulse",
                )}
              />
              {finished ? "Sent" : "Sending"}
            </Badge>
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {campaign.subject}
          </p>
        </div>
      </div>

      {/* ── Metrics grid ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label="Recipients" value={total} />
        <Metric label="Delivered" value={counts.sent} tone="primary" />
        <Metric
          label="Opened"
          value={`${openRate}%`}
          hint={`${engagement?.opensUnique ?? 0} unique`}
          tone="primary"
          soft
        />
        <Metric
          label="Clicked"
          value={`${clickRate}%`}
          hint={`${engagement?.clicksUnique ?? 0} unique`}
          tone="primary"
          soft
        />
        <Metric
          label="Click-to-open"
          value={`${clickToOpenRate}%`}
          hint="clicked, of openers"
          tone="primary"
          soft
        />
        <Metric
          label="Unsubscribed"
          value={unsubscribed}
          hint={`${unsubscribeRate}% of delivered`}
          tone={unsubscribed > 0 ? "destructive" : "muted"}
        />
        <Metric
          label="Spam reports"
          value={complained}
          hint={`${complaintRate}% · SES limit 0.5%`}
          tone={complained > 0 ? "destructive" : "muted"}
        />
        <Metric
          label="Failed"
          value={counts.failed}
          tone={counts.failed > 0 ? "destructive" : "muted"}
        />
        <Metric
          label="Bounced"
          value={counts.bounced}
          hint={
            counts.sent > 0
              ? `${((counts.bounced / total) * 100).toFixed(1)}% · SES limit 10%`
              : undefined
          }
          tone={counts.bounced > 0 ? "destructive" : "muted"}
        />
      </div>

      {/* ── Delivery progress ── */}
      <Card size="sm">
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">
              {finished
                ? `${deliveryRate}% delivered`
                : `Sending… ${done}/${total}`}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {finished
                ? `${counts.sent}/${total} delivered`
                : `${progressPercent}%`}
            </span>
          </div>
          <Progress value={finished ? deliveryRate : progressPercent} />
          <p className="text-xs text-muted-foreground">
            Delivered, failed, bounced, unsubscribes, and spam reports are
            exact. Opens and clicks are estimates — inboxes can block or
            pre-fetch tracking pixels. Unsubscribes count this
            campaign&apos;s recipients who opted out after the send.
          </p>
        </CardContent>
      </Card>

      {/* ── Recipient outcomes table ── */}
      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Recipient outcomes</CardTitle>
              <CardDescription>
                {filtered.length} of {recipients.length} recipient
                {recipients.length === 1 ? "" : "s"} shown
              </CardDescription>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 sm:w-72">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or email…"
                  className="pl-8"
                />
              </div>
              <ToggleGroup
                type="single"
                value={statusFilter}
                onValueChange={(v) => {
                  if (v) setStatusFilter(v as StatusKey);
                }}
                className="justify-start"
              >
                {filterKeys.map((key) => (
                  <ToggleGroupItem
                    key={key}
                    value={key}
                    className="gap-1.5"
                    aria-label={`Show ${STATUS_LABELS[key]} recipients`}
                  >
                    {STATUS_LABELS[key]}
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {counts[key]}
                    </span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length > 0 ? (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="min-w-64">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                            {getInitials(r.name, r.email)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-foreground">
                              {r.name || r.email.split("@")[0]}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {r.email}
                            </span>
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <RecipientStatusBadge
                          status={r.status}
                          error={r.error}
                        />
                      </TableCell>
                      <TableCell
                        className="hidden text-muted-foreground md:table-cell"
                        title={r.error ?? undefined}
                      >
                        {r.status === "sent"
                          ? formatSentAt(r.sentAt)
                          : r.error
                            ? "Not delivered"
                            : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <Empty className="border-0 py-14">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <UserRoundIcon />
                          </EmptyMedia>
                          <EmptyTitle>
                            {recipients.length === 0
                              ? "No recipients yet"
                              : "No recipients match your filters"}
                          </EmptyTitle>
                          <EmptyDescription>
                            {recipients.length === 0
                              ? "This campaign has not been sent to anyone."
                              : "Try a different search term or clear the active filter."}
                          </EmptyDescription>
                        </EmptyHeader>
                        {recipients.length > 0 && (
                          <EmptyContent>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setQuery("");
                                setStatusFilter("all");
                              }}
                            >
                              Clear filters
                            </Button>
                          </EmptyContent>
                        )}
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function Metric({
  label,
  value,
  tone = "default",
  hint,
  soft,
}: {
  label: string;
  value: number | string;
  tone?: MetricTone;
  hint?: string;
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
        {hint && (
          <div className="text-xs tabular-nums text-muted-foreground">
            {hint}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecipientStatusBadge({
  status,
  error,
}: {
  status: string;
  error: string | null;
}) {
  if (
    status === "sent" ||
    status === "failed" ||
    status === "bounced" ||
    status === "pending"
  ) {
    return (
      <Badge
        variant={STATUS_BADGE_VARIANTS[status]}
        title={error ?? undefined}
      >
        <span className="size-1.5 rounded-full bg-current" />
        {STATUS_LABELS[status]}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" title={error ?? undefined}>
      {status}
    </Badge>
  );
}

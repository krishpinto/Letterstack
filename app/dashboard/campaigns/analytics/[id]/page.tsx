"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeftIcon,
  MailIcon,
  SearchIcon,
  TriangleAlertIcon,
  UserRoundIcon,
} from "lucide-react";

import { RefreshStatus } from "@/components/analytics/refresh-status";
import { ErrorState, useAsyncData } from "@/components/data-state";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { campaignRates, formatRate } from "@/lib/analytics/rates";
import { refreshDelay } from "@/lib/analytics/refresh";
import { useAutoRefresh } from "@/lib/analytics/use-auto-refresh";
import { ApiError, fetchJson } from "@/lib/fetch-json";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProgressState = {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  /** Claimed by a worker but not finished yet (older servers omit it). */
  sending?: number;
};

type Campaign = {
  id: string;
  name: string;
  subject: string;
  status: string;
  /** Set when status is "failed": why, in words for the owner. */
  failureReason?: string | null;
  fromName?: string;
  fromEmail?: string;
  senderType?: string;
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

type AnalyticsData = {
  campaign: Campaign;
  progress: ProgressState;
  recipients: Recipient[];
  engagement: Engagement;
};

type StatusKey = "all" | "sent" | "failed" | "bounced" | "sending" | "pending";
type MetricTone = "default" | "primary" | "muted" | "destructive";

const STATUS_LABELS: Record<StatusKey, string> = {
  all: "All",
  sent: "Sent",
  failed: "Failed",
  bounced: "Bounced",
  sending: "Sending",
  pending: "Queued",
};

const STATUS_BADGE_VARIANTS = {
  sent: "default",
  failed: "destructive",
  bounced: "destructive",
  sending: "outline",
  pending: "outline",
} as const;

const FILTER_ORDER: StatusKey[] = [
  "all",
  "sent",
  "failed",
  "bounced",
  "sending",
  "pending",
];

// Rendering 50,000 rows at once freezes the tab; show them in pages.
const RECIPIENT_PAGE = 100;

const ESTIMATE_NOTE =
  "An estimate. Apple Mail Privacy Protection loads every image in advance, which records an open for each Apple Mail recipient, and some inboxes block or proxy images.";

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

/** Is LetterStack still handing recipients to the sender right now? */
function isLive(data: AnalyticsData) {
  if (data.campaign.status === "sending") return true;
  // Older rows can lag the status by a poll; trust in-flight recipients too,
  // but not the queued audience of a draft or a scheduled campaign.
  return (
    data.campaign.status !== "draft" &&
    data.campaign.status !== "scheduled" &&
    data.campaign.status !== "failed" &&
    data.progress.pending > 0
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CampaignAnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  const [visibleCount, setVisibleCount] = useState(RECIPIENT_PAGE);
  const [notFound, setNotFound] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  // One load for the whole page. If any part fails, the page says so with a
  // Retry instead of rendering zeros that look like real results.
  const state = useAsyncData<AnalyticsData>(async () => {
    try {
      const [progressRes, recipientsRes, engagementRes] = await Promise.all([
        fetchJson<{ campaign: Campaign; progress: ProgressState }>(
          `/api/campaigns/${id}/progress`,
        ),
        fetchJson<{ recipients: Recipient[] }>(`/api/campaigns/${id}/recipients`),
        fetchJson<{ engagement: Engagement }>(`/api/campaigns/${id}/analytics`),
      ]);
      setNotFound(false);
      setUpdatedAt(Date.now());
      return {
        campaign: progressRes.campaign,
        progress: progressRes.progress,
        recipients: recipientsRes.recipients ?? [],
        engagement: engagementRes.engagement,
      };
    } catch (error) {
      setNotFound(error instanceof ApiError && error.status === 404);
      throw error;
    }
  }, [id]);

  const data = state.data;
  const live = data ? isLive(data) : false;

  // Fast while the send is in flight, then every minute while the tab is
  // visible: delivery, bounce and open events keep arriving for hours.
  useAutoRefresh({
    enabled: data !== undefined,
    busy: state.refreshing,
    delayMs: refreshDelay(live),
    refresh: state.reload,
  });

  // ─── Derived ───────────────────────────────────────────────────────────────

  const recipients = useMemo(() => data?.recipients ?? [], [data]);

  const counts = useMemo(() => {
    const count: Record<StatusKey, number> = {
      all: recipients.length,
      sent: 0,
      failed: 0,
      bounced: 0,
      sending: 0,
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

  if (state.status === "loading") {
    return <PageLoader label="Loading analytics…" />;
  }

  if (!data) {
    return (
      <ErrorState
        title={notFound ? "Campaign not found" : "Couldn't load analytics"}
        message={
          notFound
            ? "It may have been deleted, or it belongs to a different workspace."
            : (state.error ?? "Something went wrong. Try again.")
        }
        onRetry={notFound ? undefined : () => void state.reload()}
        retrying={state.refreshing}
        action={
          <Button variant={notFound ? "default" : "ghost"} asChild>
            <Link href="/dashboard/campaigns">
              <ArrowLeftIcon data-icon="inline-start" />
              Back to campaigns
            </Link>
          </Button>
        }
      />
    );
  }

  const { campaign, progress, engagement } = data;
  const refreshError = state.status === "error" ? state.error : null;

  const total = progress.total;
  const done = progress.sent + progress.failed;
  const progressPercent = total > 0 ? Math.round((done / total) * 100) : 0;
  const sentPercent = total > 0 ? Math.round((progress.sent / total) * 100) : 0;

  // Same formulas as the analytics overview (lib/analytics/rates.ts), so a
  // campaign shows the same numbers on both pages.
  const rates = campaignRates({
    sent: progress.sent,
    delivered: engagement.delivered,
    bounced: engagement.bounced,
    complained: engagement.complained,
    opensUnique: engagement.opensUnique,
    clicksUnique: engagement.clicksUnique,
    unsubscribed: engagement.unsubscribed,
  });

  const filterKeys = FILTER_ORDER.filter((k) => k === "all" || counts[k] > 0);
  const shown = filtered.slice(0, visibleCount);

  // Gmail sends have no delivery-events source — no SES webhook equivalent,
  // so delivered/bounced/opens/clicks would just be permanently zero rather
  // than genuinely absent. Showing that as a normal-looking zeroed chart
  // reads as broken; say the honest thing instead.
  const sentViaGmail = campaign.senderType === "mailbox";

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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-normal">
                {campaign.name}
              </h1>
              <CampaignStatusBadge status={campaign.status} live={live} />
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {campaign.subject}
            </p>
          </div>
          <RefreshStatus
            updatedAt={updatedAt}
            refreshing={state.refreshing}
            error={refreshError}
            onRefresh={() => void state.reload()}
            className="shrink-0"
          />
        </div>
      </div>

      {campaign.status === "failed" && (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>This campaign failed</AlertTitle>
          <AlertDescription>
            {campaign.failureReason ||
              "The send stopped before every recipient was reached. Open the campaign for details."}
          </AlertDescription>
        </Alert>
      )}

      {/* ── Metrics grid ── */}
      {sentViaGmail ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Metric label="Recipients" value={total} />
            <Metric label="Sent" value={progress.sent} tone="primary" />
            <Metric
              label="Failed"
              value={progress.failed}
              tone={progress.failed > 0 ? "destructive" : "muted"}
            />
          </div>
          <Alert>
            <MailIcon />
            <AlertTitle>Gmail doesn&apos;t report back to LetterStack</AlertTitle>
            <AlertDescription>
              Delivery, opens, and clicks aren&apos;t available for a campaign
              sent through a connected Gmail account — Gmail has no
              equivalent of SES&apos;s delivery webhook. Check the Sent folder
              in that Gmail account for the record of what actually went out.
            </AlertDescription>
          </Alert>
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Recipients" value={total} />
          <Metric label="Sent" value={progress.sent} hint="handed to SES" />
          <Metric
            label="Delivered"
            value={engagement.delivered}
            hint={`${formatRate(rates.deliveryRate)} of sent`}
            tone="primary"
          />
          <Metric
            label="Opened"
            value={formatRate(rates.openRate)}
            hint={`${engagement.opensUnique} unique · of delivered`}
            tone="primary"
            estimate
          />
          <Metric
            label="Clicked"
            value={formatRate(rates.clickRate)}
            hint={`${engagement.clicksUnique} unique · of delivered`}
            tone="primary"
            estimate
          />
          <Metric
            label="Click-to-open"
            value={formatRate(rates.clickToOpenRate)}
            hint="clicked, of openers"
            tone="primary"
            estimate
          />
          <Metric
            label="Unsubscribed"
            value={engagement.unsubscribed}
            hint={`${formatRate(rates.unsubscribeRate)} of delivered`}
            tone={engagement.unsubscribed > 0 ? "destructive" : "muted"}
          />
          <Metric
            label="Spam reports"
            value={engagement.complained}
            hint={`${formatRate(rates.complaintRate, 2)} · SES limit 0.5%`}
            tone={engagement.complained > 0 ? "destructive" : "muted"}
          />
          <Metric
            label="Bounced"
            value={engagement.bounced}
            hint={`${formatRate(rates.bounceRate)} of sent · SES limit 10%`}
            tone={engagement.bounced > 0 ? "destructive" : "muted"}
          />
          <Metric
            label="Failed"
            value={progress.failed}
            hint="not handed to SES"
            tone={progress.failed > 0 ? "destructive" : "muted"}
          />
        </div>
      )}

      {/* ── Send progress ── */}
      <Card size="sm">
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">
              {live
                ? `Sending… ${done}/${total}`
                : total === 0
                  ? "No recipients yet"
                  : `${sentPercent}% sent`}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {live
                ? `${progressPercent}%`
                : `${progress.sent}/${total} sent`}
            </span>
          </div>
          <Progress value={live ? progressPercent : sentPercent} />
          <p className="text-xs text-muted-foreground">
            {sentViaGmail
              ? "This reflects LetterStack's own send attempts, not a delivery confirmation from Gmail — it has no equivalent of SES's delivery webhook."
              : "Sent, delivered, failed, bounced, unsubscribes and spam reports are exact. Opens and clicks are estimates: Apple Mail Privacy Protection loads images for every Apple Mail recipient, and some inboxes block them. Open, click, unsubscribe and spam rates are of delivered; bounce rate is of sent. Unsubscribes count this campaign's recipients who opted out after the send."}
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
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setVisibleCount(RECIPIENT_PAGE);
                  }}
                  placeholder="Search name or email…"
                  className="pl-8"
                />
              </div>
              <ToggleGroup
                type="single"
                value={statusFilter}
                onValueChange={(v) => {
                  if (v) {
                    setStatusFilter(v as StatusKey);
                    setVisibleCount(RECIPIENT_PAGE);
                  }
                }}
                className="flex-wrap justify-start"
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

        <CardContent className="flex flex-col gap-3">
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
                {shown.length > 0 ? (
                  shown.map((r) => (
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
          {filtered.length > shown.length && (
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Showing {shown.length.toLocaleString()} of{" "}
                {filtered.length.toLocaleString()}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisibleCount((n) => n + RECIPIENT_PAGE)}
              >
                Show {Math.min(RECIPIENT_PAGE, filtered.length - shown.length)}{" "}
                more
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CampaignStatusBadge({ status, live }: { status: string; live: boolean }) {
  if (live) {
    return (
      <Badge variant="outline">
        <span className="size-1.5 animate-pulse rounded-full bg-current" />
        Sending
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="destructive">
        <span className="size-1.5 rounded-full bg-current" />
        Failed
      </Badge>
    );
  }
  const label =
    status === "sent"
      ? "Sent"
      : status === "scheduled"
        ? "Scheduled"
        : status === "draft"
          ? "Draft"
          : status === "sending"
            ? "Sending"
            : status;
  return (
    <Badge variant={status === "sent" ? "default" : "outline"}>
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </Badge>
  );
}

function Metric({
  label,
  value,
  tone = "default",
  hint,
  estimate,
}: {
  label: string;
  value: number | string;
  tone?: MetricTone;
  hint?: string;
  /** Opens and clicks: tracking-pixel based, so marked as an estimate. */
  estimate?: boolean;
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
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          {label}
          {estimate && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" tabIndex={0} aria-label={ESTIMATE_NOTE}>
                  est
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-64">{ESTIMATE_NOTE}</TooltipContent>
            </Tooltip>
          )}
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
    status === "sending" ||
    status === "pending"
  ) {
    return (
      <Badge
        variant={STATUS_BADGE_VARIANTS[status]}
        title={error ?? undefined}
      >
        <span
          className={cn(
            "size-1.5 rounded-full bg-current",
            status === "sending" && "animate-pulse",
          )}
        />
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

"use client";

import {
  ActivityIcon,
  AlertTriangleIcon,
  CloudUploadIcon,
  DatabaseIcon,
  MailIcon,
  SparklesIcon,
  ZapIcon,
} from "lucide-react";

import { PolarAngleAxis as RechartsPolarAngleAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { type ChartConfig } from "@/components/evilcharts/ui/chart";
import {
  EvilRadialChart,
  RadialBar,
  Tooltip as RadialTooltip,
  Legend as RadialLegend,
} from "@/components/evilcharts/charts/radial-chart";
import {
  EvilRadarChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  Tooltip as RadarTooltip,
} from "@/components/evilcharts/charts/radar-chart";
import { cn } from "@/lib/utils";
import { formatBytes, LimitBar, usageTone } from "./limit-bar";

// The analytics tab: the all-time platform numbers first, then everything
// that could get the account capped or suspended. Split out of the page so
// the page itself is only a shell around the two tabs.

type Block<T> = { ok: true; data: T } | { ok: false; error: string };

export type InfraPayload = {
  ok: boolean;
  generatedAt: string;
  ses: Block<{
    sendingEnabled: boolean;
    productionAccess: boolean;
    sentLast24h: number;
    max24h: number;
    maxSendRate: number;
    enforcementStatus: string;
  }>;
  reputation7d: Block<Reputation>;
  reputation30d: Block<Reputation>;
  qstash: Block<{
    estimatedMessagesToday: number;
    dailyLimit: number;
    note: string;
  }>;
  uploadthing: Block<{
    usedBytes: number;
    limitBytes: number;
    filesUploaded: number;
  }>;
  neon: Block<{ usedBytes: number; limitBytes: number }>;
  platform: Block<{
    users: number;
    usersLast7d: number;
    organizations: number;
    paidOrganizations: number;
    recipients: number;
    campaigns: number;
    campaignsSent: number;
    emailsSent: number;
    suppressed: number;
    automations: number;
  }>;
  gemini: Block<{
    models: Array<{
      id: string;
      label: string;
      requestsToday: number;
      dailyRequestLimit: number;
      tokensToday: number;
      dailyTokenLimit: number;
      requestsLastMinute: number;
      rpmLimit: number;
      monthCalls: number;
      monthTokens: number;
      exhausted: boolean;
      exhaustedBy: "requests" | "tokens" | null;
    }>;
    monthCalls: number;
    monthTokens: number;
    avgTokensPerCall: number;
    failuresThisMonth: number;
  }>;
};

type Reputation = {
  delivered: number;
  bounced: number;
  complaints: number;
  bounceRate: number;
  complaintRate: number;
};

function BlockCard({
  title,
  icon: Icon,
  block,
  children,
}: {
  title: string;
  icon: React.ElementType;
  block: Block<unknown>;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {block.ok ? (
          children
        ) : (
          <p className="flex items-start gap-2 text-sm text-destructive">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
            {block.error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function RateRow({
  label,
  rate,
  limit,
  detail,
}: {
  label: string;
  rate: number;
  limit: number;
  detail: string;
}) {
  const pctOfLimit = limit > 0 ? (rate / limit) * 100 : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className={cn("font-semibold tabular-nums", usageTone(pctOfLimit))}>
          {rate.toFixed(2)}%
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            limit {limit}%
          </span>
        </span>
      </div>
      <Progress value={Math.min(100, pctOfLimit)} />
      <p className="text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

// ─── Warnings ─────────────────────────────────────────────────────────────────

type Warning = { level: "warn" | "critical"; message: string };

/** Everything that could get us suspended or capped, in one scan. */
function collectWarnings(data: InfraPayload): Warning[] {
  const warnings: Warning[] = [];

  const pctWarn = (
    label: string,
    used: number,
    limit: number,
    format: (n: number) => string = (n) => n.toLocaleString(),
  ) => {
    if (limit <= 0) return;
    const pct = (used / limit) * 100;
    if (pct >= 90) {
      warnings.push({
        level: "critical",
        message: `${label} at ${pct.toFixed(0)}% of limit (${format(used)} of ${format(limit)})`,
      });
    } else if (pct >= 70) {
      warnings.push({
        level: "warn",
        message: `${label} at ${pct.toFixed(0)}% of limit (${format(used)} of ${format(limit)})`,
      });
    }
  };

  if (data.ses.ok) {
    const s = data.ses.data;
    if (!s.sendingEnabled) {
      warnings.push({ level: "critical", message: "SES sending is DISABLED on this account" });
    }
    if (s.enforcementStatus !== "HEALTHY" && s.enforcementStatus !== "UNKNOWN") {
      warnings.push({
        level: "critical",
        message: `SES enforcement status is ${s.enforcementStatus} — account under review`,
      });
    }
    pctWarn("SES 24h send quota", s.sentLast24h, s.max24h);
  }
  if (data.reputation30d.ok) {
    const r = data.reputation30d.data;
    pctWarn("Bounce rate (30d, suspension at 10%)", r.bounceRate, 10, (n) => `${n.toFixed(2)}%`);
    pctWarn("Complaint rate (30d, suspension at 0.5%)", r.complaintRate, 0.5, (n) => `${n.toFixed(2)}%`);
  }
  if (data.qstash.ok) {
    pctWarn("QStash daily messages (est.)", data.qstash.data.estimatedMessagesToday, data.qstash.data.dailyLimit);
  }
  if (data.uploadthing.ok) {
    pctWarn("UploadThing storage", data.uploadthing.data.usedBytes, data.uploadthing.data.limitBytes, formatBytes);
  }
  if (data.neon.ok) {
    pctWarn("Neon database storage", data.neon.data.usedBytes, data.neon.data.limitBytes, formatBytes);
  }

  // A provider we can't read is itself a warning — blind spots bite.
  for (const [label, block] of [
    ["SES", data.ses],
    ["Reputation", data.reputation30d],
    ["QStash", data.qstash],
    ["UploadThing", data.uploadthing],
    ["Neon", data.neon],
  ] as const) {
    if (!block.ok) warnings.push({ level: "warn", message: `Could not check ${label}: ${block.error}` });
  }

  return warnings.sort((a) => (a.level === "critical" ? -1 : 1));
}

// ─── Chart configs (evilcharts) ───────────────────────────────────────────────

const usageRadialConfig = {
  ses: { label: "SES 24h quota", colors: { light: ["#0284c7"], dark: ["#38bdf8"] } },
  qstash: { label: "QStash daily", colors: { light: ["#7c3aed"], dark: ["#a78bfa"] } },
  uploadthing: { label: "UploadThing", colors: { light: ["#dc2626"], dark: ["#f87171"] } },
  neon: { label: "Neon storage", colors: { light: ["#059669"], dark: ["#34d399"] } },
} satisfies ChartConfig;

const riskRadarConfig = {
  usage: { label: "% of limit", colors: { light: ["#d97706"], dark: ["#fbbf24"] } },
} satisfies ChartConfig;

const pctOf = (used: number, limit: number) =>
  limit > 0 ? Math.min(100, Math.round((used / limit) * 1000) / 10) : 0;

export function AnalyticsTab({ data }: { data: InfraPayload }) {
  const rep = data.reputation30d.ok ? data.reputation30d.data : null;
  const rep7 = data.reputation7d.ok ? data.reputation7d.data : null;

  const warnings = collectWarnings(data);
  const critical = warnings.filter((w) => w.level === "critical");

  // % of each limit consumed — the radial gauge and risk radar read these.
  const usagePcts = {
    ses: data.ses.ok ? pctOf(data.ses.data.sentLast24h, data.ses.data.max24h) : 0,
    qstash: data.qstash.ok
      ? pctOf(data.qstash.data.estimatedMessagesToday, data.qstash.data.dailyLimit)
      : 0,
    uploadthing: data.uploadthing.ok
      ? pctOf(data.uploadthing.data.usedBytes, data.uploadthing.data.limitBytes)
      : 0,
    neon: data.neon.ok ? pctOf(data.neon.data.usedBytes, data.neon.data.limitBytes) : 0,
  };

  const radialData = [
    { service: "ses", usage: usagePcts.ses },
    { service: "qstash", usage: usagePcts.qstash },
    { service: "uploadthing", usage: usagePcts.uploadthing },
    { service: "neon", usage: usagePcts.neon },
  ];

  const radarData = [
    { metric: "SES quota", usage: usagePcts.ses },
    { metric: "QStash", usage: usagePcts.qstash },
    { metric: "Uploads", usage: usagePcts.uploadthing },
    { metric: "Neon", usage: usagePcts.neon },
    { metric: "Bounces", usage: rep ? pctOf(rep.bounceRate, 10) : 0 },
    { metric: "Complaints", usage: rep ? pctOf(rep.complaintRate, 0.5) : 0 },
  ];

  const platform = data.platform.ok ? data.platform.data : null;

  return (
    <div className="flex flex-col gap-6">
      {/* ── All-time platform stats. First thing on the page because it's the
          only block here that answers "how are we doing" rather than "what is
          about to break". ── */}
      <BlockCard title="Platform — all time" icon={ActivityIcon} block={data.platform}>
        {platform && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {[
              {
                label: "Users",
                value: platform.users,
                sub: platform.usersLast7d > 0 ? `+${platform.usersLast7d} this week` : undefined,
              },
              {
                label: "Workspaces",
                value: platform.organizations,
                sub: `${platform.paidOrganizations} on a paid plan`,
              },
              { label: "Contacts", value: platform.recipients },
              { label: "Emails sent", value: platform.emailsSent },
              {
                label: "Campaigns",
                value: platform.campaigns,
                sub: `${platform.campaignsSent} sent`,
              },
              { label: "Suppressed", value: platform.suppressed },
              { label: "Automations", value: platform.automations },
              {
                label: "Delivered (30d)",
                value: rep ? rep.delivered : 0,
                sub: "confirmed by SES",
              },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col gap-0.5">
                <span className="text-2xl font-semibold tabular-nums">
                  {stat.value.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">{stat.label}</span>
                {stat.sub && (
                  <span className="text-[11px] text-muted-foreground/70">{stat.sub}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </BlockCard>

      {/* ── Warning zone ── */}
      <Card
        className={cn(
          critical.length > 0
            ? "border-red-500/50 bg-red-500/5"
            : warnings.length > 0
              ? "border-amber-500/50 bg-amber-500/5"
              : "border-emerald-500/40 bg-emerald-500/5",
        )}
      >
        <CardContent className="flex flex-col gap-2">
          {warnings.length === 0 ? (
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-500">
              <ActivityIcon className="size-4" />
              All systems comfortably inside limits. Nothing is about to bail on us.
            </p>
          ) : (
            <>
              <p className="text-sm font-semibold">
                {critical.length > 0
                  ? `${critical.length} critical issue${critical.length === 1 ? "" : "s"} — act now`
                  : `${warnings.length} warning${warnings.length === 1 ? "" : "s"} — keep an eye on these`}
              </p>
              <ul className="flex flex-col gap-1.5">
                {warnings.map((warning) => (
                  <li
                    key={warning.message}
                    className={cn(
                      "flex items-start gap-2 text-sm",
                      warning.level === "critical" ? "text-red-500" : "text-amber-500",
                    )}
                  >
                    <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
                    {warning.message}
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Usage charts ── */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usage of each limit</CardTitle>
          </CardHeader>
          <CardContent>
            <EvilRadialChart
              config={usageRadialConfig}
              data={radialData}
              nameKey="service"
              className="mx-auto aspect-square max-h-72 w-full"
              innerRadius="35%"
            >
              {/* Fixed 0–100 scale so bars read as % of limit, not relative to each other */}
              <RechartsPolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar dataKey="usage" isClickable />
              <RadialTooltip />
              <RadialLegend isClickable />
            </EvilRadialChart>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk radar — % of each suspension/limit line</CardTitle>
          </CardHeader>
          <CardContent>
            <EvilRadarChart
              config={riskRadarConfig}
              data={radarData}
              className="mx-auto aspect-square max-h-72 w-full"
            >
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" />
              <Radar dataKey="usage" isGlowing />
              <RadarTooltip />
            </EvilRadarChart>
          </CardContent>
        </Card>
      </div>

      {/* Danger row: the two things that can actually kill us */}
      <div className="grid gap-4 md:grid-cols-2">
        <BlockCard title="SES sending quota" icon={MailIcon} block={data.ses}>
          {data.ses.ok && (
            <div className="flex flex-col gap-4">
              <LimitBar used={data.ses.data.sentLast24h} limit={data.ses.data.max24h} />
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant={data.ses.data.sendingEnabled ? "secondary" : "destructive"}>
                  Sending {data.ses.data.sendingEnabled ? "enabled" : "DISABLED"}
                </Badge>
                <Badge variant={data.ses.data.productionAccess ? "secondary" : "destructive"}>
                  {data.ses.data.productionAccess ? "Production access" : "SANDBOX"}
                </Badge>
                <Badge variant="secondary">{data.ses.data.maxSendRate}/sec rate</Badge>
                {data.ses.data.enforcementStatus !== "HEALTHY" && (
                  <Badge variant="destructive">{data.ses.data.enforcementStatus}</Badge>
                )}
              </div>
            </div>
          )}
        </BlockCard>

        <BlockCard
          title="SES reputation (last 30 days)"
          icon={ActivityIcon}
          block={data.reputation30d}
        >
          {rep && (
            <div className="flex flex-col gap-4">
              <RateRow
                label="Bounce rate"
                rate={rep.bounceRate}
                limit={10}
                detail={`${rep.bounced.toLocaleString()} bounces / ${rep.delivered.toLocaleString()} delivered · 7d: ${rep7 ? rep7.bounceRate.toFixed(2) : "—"}%`}
              />
              <RateRow
                label="Complaint rate"
                rate={rep.complaintRate}
                limit={0.5}
                detail={`${rep.complaints.toLocaleString()} complaints · 7d: ${rep7 ? rep7.complaintRate.toFixed(2) : "—"}%`}
              />
            </div>
          )}
        </BlockCard>
      </div>

      {/* Service limits */}
      <div className="grid gap-4 md:grid-cols-3">
        <BlockCard title="QStash (free: 500/day)" icon={ZapIcon} block={data.qstash}>
          {data.qstash.ok && (
            <div className="flex flex-col gap-2">
              <LimitBar
                used={data.qstash.data.estimatedMessagesToday}
                limit={data.qstash.data.dailyLimit}
              />
              <p className="text-xs text-muted-foreground">{data.qstash.data.note}</p>
            </div>
          )}
        </BlockCard>

        <BlockCard title="UploadThing storage" icon={CloudUploadIcon} block={data.uploadthing}>
          {data.uploadthing.ok && (
            <div className="flex flex-col gap-2">
              <LimitBar
                used={data.uploadthing.data.usedBytes}
                limit={data.uploadthing.data.limitBytes}
                format={formatBytes}
              />
              <p className="text-xs text-muted-foreground">
                {data.uploadthing.data.filesUploaded.toLocaleString()} files uploaded
              </p>
            </div>
          )}
        </BlockCard>

        <BlockCard title="Neon storage (free: 512MB)" icon={DatabaseIcon} block={data.neon}>
          {data.neon.ok && (
            <LimitBar
              used={data.neon.data.usedBytes}
              limit={data.neon.data.limitBytes}
              format={formatBytes}
            />
          )}
        </BlockCard>
      </div>

      {/* Gemini / AI assistant usage */}
      <BlockCard title="Gemini — this month" icon={SparklesIcon} block={data.gemini}>
        {data.gemini.ok && (
          <div className="flex flex-col gap-4">
            {/* Per model, because Google meters each one separately — when
                the assistant stops, the question is which model ran out and
                which still has room. */}
            <div className="flex flex-col gap-4">
              {data.gemini.data.models.map((model) => (
                <div key={model.id} className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {model.label}
                      {model.exhausted && (
                        <Badge variant="destructive" className="text-[10px]">
                          Out of {model.exhaustedBy}
                        </Badge>
                      )}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {model.requestsLastMinute}/{model.rpmLimit} per min
                    </span>
                  </div>
                  {/* Tokens first: on an agent workload it's the ceiling that
                      actually runs out, while request count stays near zero. */}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <p className="text-[11px] text-muted-foreground">Tokens today</p>
                      <LimitBar used={model.tokensToday} limit={model.dailyTokenLimit} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-[11px] text-muted-foreground">Requests today</p>
                      <LimitBar used={model.requestsToday} limit={model.dailyRequestLimit} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 border-t pt-3 sm:grid-cols-4">
              {[
                { label: "Tokens", value: data.gemini.data.monthTokens.toLocaleString() },
                { label: "Calls", value: data.gemini.data.monthCalls.toLocaleString() },
                {
                  label: "Avg / call",
                  value: data.gemini.data.avgTokensPerCall.toLocaleString(),
                  // Rising average means conversation context is growing
                  // faster than history trimming is cutting it back.
                  sub: "context health",
                },
                { label: "Failed", value: data.gemini.data.failuresThisMonth.toLocaleString() },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-lg font-semibold tabular-nums">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  {stat.sub && (
                    <p className="text-[10px] text-muted-foreground/70">{stat.sub}</p>
                  )}
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              Quotas are per model and reset at midnight UTC, so an exhausted
              model doesn&apos;t block the others — switch in the
              assistant&apos;s model picker. Token ceilings are estimates
              calibrated from observed refusals (3.6 Flash was cut off around
              142k tokens in a day, at only 19 requests), not published
              figures. Google&apos;s own 429 is the real authority; tune the
              estimates as you watch more days.
            </p>
          </div>
        )}
      </BlockCard>
    </div>
  );
}

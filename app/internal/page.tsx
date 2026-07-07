"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIcon,
  AlertTriangleIcon,
  CloudUploadIcon,
  DatabaseIcon,
  MailIcon,
  RefreshCwIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageLoader } from "@/components/bar-spinner";
import { cn } from "@/lib/utils";

// Founder-only infra monitor (krish + Ethan, via ADMIN_EMAILS). Not linked
// from anywhere in the product — bookmark /internal.

type Block<T> = { ok: true; data: T } | { ok: false; error: string };

type InfraPayload = {
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
    recipients: number;
    campaigns: number;
    campaignsSent: number;
    suppressed: number;
    automations: number;
  }>;
};

type Reputation = {
  delivered: number;
  bounced: number;
  complaints: number;
  bounceRate: number;
  complaintRate: number;
};

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

/** Color a usage percentage: fine → warm → red. */
function usageTone(pct: number) {
  if (pct >= 90) return "text-red-500";
  if (pct >= 70) return "text-amber-500";
  return "text-emerald-500";
}

function LimitBar({
  used,
  limit,
  format,
}: {
  used: number;
  limit: number;
  format?: (n: number) => string;
}) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const fmt = format ?? ((n: number) => n.toLocaleString());
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className={cn("font-semibold tabular-nums", usageTone(pct))}>
          {fmt(used)}
        </span>
        <span className="text-xs text-muted-foreground">
          of {fmt(limit)} ({pct.toFixed(pct < 10 ? 1 : 0)}%)
        </span>
      </div>
      <Progress value={pct} />
    </div>
  );
}

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

export default function InternalInfraPage() {
  const [data, setData] = useState<InfraPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/internal/infra");
      if (r.status === 404) {
        setDenied(true);
        return;
      }
      const payload = await r.json();
      if (payload.ok) setData(payload);
    } catch {
      // keep the last snapshot
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (denied) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background text-sm text-muted-foreground">
        Nothing here.
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background">
        <PageLoader />
      </main>
    );
  }

  const rep = data.reputation30d.ok ? data.reputation30d.data : null;
  const rep7 = data.reputation7d.ok ? data.reputation7d.data : null;

  return (
    <main className="min-h-svh bg-background px-4 py-8 md:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">
              Infra monitor
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Limits, reputation, and platform stats — founders only.
              Snapshot from {new Date(data.generatedAt).toLocaleTimeString()}.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCwIcon
              data-icon="inline-start"
              className={cn(loading && "animate-spin")}
            />
            Refresh
          </Button>
        </div>

        {/* Danger row: the two things that can actually kill us */}
        <div className="grid gap-4 md:grid-cols-2">
          <BlockCard title="SES sending quota" icon={MailIcon} block={data.ses}>
            {data.ses.ok && (
              <div className="flex flex-col gap-4">
                <LimitBar
                  used={data.ses.data.sentLast24h}
                  limit={data.ses.data.max24h}
                />
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant={data.ses.data.sendingEnabled ? "secondary" : "destructive"}>
                    Sending {data.ses.data.sendingEnabled ? "enabled" : "DISABLED"}
                  </Badge>
                  <Badge variant={data.ses.data.productionAccess ? "secondary" : "destructive"}>
                    {data.ses.data.productionAccess ? "Production access" : "SANDBOX"}
                  </Badge>
                  <Badge variant="secondary">
                    {data.ses.data.maxSendRate}/sec rate
                  </Badge>
                  {data.ses.data.enforcementStatus !== "HEALTHY" && (
                    <Badge variant="destructive">
                      {data.ses.data.enforcementStatus}
                    </Badge>
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
                <p className="text-xs text-muted-foreground">
                  {data.qstash.data.note}
                </p>
              </div>
            )}
          </BlockCard>

          <BlockCard
            title="UploadThing storage"
            icon={CloudUploadIcon}
            block={data.uploadthing}
          >
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

        {/* Platform stats */}
        <BlockCard title="Platform" icon={UsersIcon} block={data.platform}>
          {data.platform.ok && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                {
                  label: "Users",
                  value: data.platform.data.users,
                  sub: `+${data.platform.data.usersLast7d} this week`,
                },
                { label: "Workspaces", value: data.platform.data.organizations },
                { label: "Contacts", value: data.platform.data.recipients },
                { label: "Suppressed", value: data.platform.data.suppressed },
                { label: "Campaigns", value: data.platform.data.campaigns },
                { label: "Campaigns sent", value: data.platform.data.campaignsSent },
                { label: "Automations", value: data.platform.data.automations },
                {
                  label: "Delivered (30d)",
                  value: rep ? rep.delivered : 0,
                },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col gap-0.5">
                  <span className="text-2xl font-semibold tabular-nums">
                    {stat.value.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {stat.label}
                  </span>
                  {"sub" in stat && stat.sub && (
                    <span className="text-xs text-emerald-500">{stat.sub}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </BlockCard>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

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

function pct(part: number, whole: number) {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AnalyticsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => setRows(d.ok ? d.campaigns : []))
      .catch(() => setRows([]));
  }, []);

  // Account-wide rollups across all campaigns.
  const totals = useMemo(() => {
    const t = { sent: 0, opensUnique: 0, clicksUnique: 0, bounced: 0 };
    (rows ?? []).forEach((r) => {
      t.sent += r.sentCount;
      t.opensUnique += r.engagement.opensUnique;
      t.clicksUnique += r.engagement.clicksUnique;
      t.bounced += r.engagement.bounced;
    });
    return t;
  }, [rows]);

  if (rows === null) return <div className="p-8 text-sm text-zinc-400">Loading analytics…</div>;

  return (
    <div className="flex h-full flex-col text-zinc-900">
      <div className="px-7 pt-6">
        <h1 className="text-[22px] font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-[13.5px] text-zinc-500">
          Delivery is exact. <span className="text-zinc-400">Opens &amp; clicks are estimates</span> —
          many inboxes block or pre-fetch tracking, so treat them as a floor, not a count.
        </p>
      </div>

      {/* Account rollup */}
      <div className="px-7 pt-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Emails delivered" value={totals.sent} tone="text-zinc-900" />
          <Metric
            label="Avg. open rate"
            value={`${pct(totals.opensUnique, totals.sent)}%`}
            tone="text-indigo-600"
            soft
          />
          <Metric
            label="Avg. click rate"
            value={`${pct(totals.clicksUnique, totals.sent)}%`}
            tone="text-indigo-600"
            soft
          />
          <Metric
            label="Bounced"
            value={totals.bounced}
            tone={totals.bounced > 0 ? "text-orange-600" : "text-zinc-400"}
          />
        </div>
      </div>

      {/* Per-campaign table */}
      <div className="mx-7 mb-7 mt-5 flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,.03)]">
        <div
          className="grid items-center border-b border-zinc-100 bg-[#fbfbfc] px-4 text-[11px] font-semibold uppercase tracking-[.04em] text-zinc-400"
          style={{ gridTemplateColumns: "minmax(200px,2fr) 110px 90px 90px 90px 110px", height: 40 }}
        >
          <div>Campaign</div>
          <div className="text-right">Sent</div>
          <div className="text-right">Opens</div>
          <div className="text-right">Clicks</div>
          <div className="text-right">Bounced</div>
          <div className="text-right">Date</div>
        </div>

        {rows.length > 0 ? (
          rows.map((r) => {
            const openRate = pct(r.engagement.opensUnique, r.sentCount);
            const clickRate = pct(r.engagement.clicksUnique, r.sentCount);
            return (
              <Link
                key={r.id}
                href={`/dashboard/campaigns/${r.id}`}
                className="grid items-center border-b border-zinc-50 px-4 transition-colors last:border-0 hover:bg-zinc-50/70"
                style={{ gridTemplateColumns: "minmax(200px,2fr) 110px 90px 90px 90px 110px", height: 60 }}
              >
                <div className="min-w-0 pr-3">
                  <div className="truncate text-[14px] font-medium text-zinc-900">{r.name}</div>
                  <div className="truncate text-[12.5px] text-zinc-400">{r.subject}</div>
                </div>
                <div className="text-right text-[14px] tabular-nums text-zinc-700">{r.sentCount}</div>
                <div className="text-right">
                  <div className="text-[14px] tabular-nums text-zinc-900">{openRate}%</div>
                  <div className="text-[11.5px] tabular-nums text-zinc-400">{r.engagement.opensUnique}</div>
                </div>
                <div className="text-right">
                  <div className="text-[14px] tabular-nums text-zinc-900">{clickRate}%</div>
                  <div className="text-[11.5px] tabular-nums text-zinc-400">{r.engagement.clicksUnique}</div>
                </div>
                <div
                  className={`text-right text-[14px] tabular-nums ${
                    r.engagement.bounced > 0 ? "text-orange-600" : "text-zinc-400"
                  }`}
                >
                  {r.engagement.bounced}
                </div>
                <div className="text-right text-[13px] tabular-nums text-zinc-500">{formatDate(r.sentAt)}</div>
              </Link>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-[15.5px] font-semibold text-zinc-800">No campaigns sent yet</div>
            <div className="mt-1 max-w-[340px] text-[13.5px] text-zinc-400">
              Once you send a campaign, its delivery and engagement show up here.
            </div>
            <Link
              href="/dashboard/campaigns"
              className="mt-4 rounded-[9px] border border-zinc-200 bg-white px-4 py-2 text-[13.5px] font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Go to campaigns
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  soft,
}: {
  label: string;
  value: number | string;
  tone: string;
  soft?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,.03)]">
      <div className={`text-[26px] font-semibold tabular-nums leading-none ${tone}`}>{value}</div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-zinc-500">
        {label}
        {soft && (
          <span className="rounded bg-zinc-100 px-1 py-0.5 text-[9.5px] font-semibold uppercase text-zinc-400">
            est
          </span>
        )}
      </div>
    </div>
  );
}

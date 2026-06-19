"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Progress = { total: number; sent: number; failed: number; pending: number };
type Campaign = { id: string; name: string; subject: string; status: string };
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
};

type StatusKey = "all" | "sent" | "failed" | "bounced" | "pending";

const STATUS = {
  sent: { label: "Sent", bg: "bg-emerald-50", fg: "text-emerald-700", dot: "bg-emerald-500" },
  failed: { label: "Failed", bg: "bg-red-50", fg: "text-red-600", dot: "bg-red-500" },
  bounced: { label: "Bounced", bg: "bg-orange-50", fg: "text-orange-700", dot: "bg-orange-500" },
  pending: { label: "Sending", bg: "bg-amber-50", fg: "text-amber-700", dot: "bg-amber-500" },
} as const;

const AVATAR_COLORS: [string, string][] = [
  ["bg-indigo-100", "text-indigo-700"],
  ["bg-pink-100", "text-pink-700"],
  ["bg-emerald-100", "text-emerald-700"],
  ["bg-amber-100", "text-amber-700"],
  ["bg-sky-100", "text-sky-700"],
  ["bg-purple-100", "text-purple-700"],
  ["bg-red-100", "text-red-700"],
  ["bg-cyan-100", "text-cyan-700"],
];

function getInitials(name: string | null, email: string) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
  }
  return email[0].toUpperCase();
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

// The post-send view: headline metrics + a per-recipient outcome list (styled
// like the Audience page). While a campaign is still sending it polls live;
// once finished it settles into a static report.
export function CampaignMonitor() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");

  // Poll progress + recipients + engagement every 1.5s; stop once nothing is
  // pending. (Opens/clicks keep trickling in for days, but we stop the live
  // poll when the send finishes — a reload picks up later engagement.)
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      const [pRes, rRes, eRes] = await Promise.all([
        fetch(`/api/campaigns/${id}/progress`).then((r) => r.json()),
        fetch(`/api/campaigns/${id}/recipients`).then((r) => r.json()),
        fetch(`/api/campaigns/${id}/analytics`).then((r) => r.json()),
      ]);
      if (!active) return;
      if (pRes.ok) {
        setCampaign(pRes.campaign);
        setProgress(pRes.progress);
        if (rRes.ok) setRecipients(rRes.recipients);
        if (eRes.ok) setEngagement(eRes.engagement);
        if (pRes.progress.pending > 0 || pRes.progress.total === 0) {
          timer = setTimeout(poll, 1500);
        }
      }
    }
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id]);

  // Counts derived from the recipient rows themselves, so the metric cards and
  // the table always agree (the table reflects bounce overrides from SES).
  const counts = useMemo(() => {
    const c = { all: recipients.length, sent: 0, failed: 0, bounced: 0, pending: 0 };
    recipients.forEach((r) => {
      if (r.status in c) c[r.status as keyof typeof c]++;
    });
    return c;
  }, [recipients]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipients.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q && !`${r.name || ""} ${r.email}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [recipients, query, statusFilter]);

  if (!campaign || !progress) {
    return <div className="p-8 text-sm text-zinc-400">Loading…</div>;
  }

  const total = progress.total;
  const done = progress.sent + progress.failed;
  const finished = total > 0 && progress.pending === 0;
  const deliveryRate = total > 0 ? Math.round((counts.sent / total) * 100) : 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  // Engagement rates use delivered-to count (counts.sent) as the denominator.
  const rate = (part: number) => (counts.sent > 0 ? Math.round((part / counts.sent) * 100) : 0);
  const openRate = rate(engagement?.opensUnique ?? 0);
  const clickRate = rate(engagement?.clicksUnique ?? 0);

  // Only offer filter tabs for statuses that actually occur in this campaign.
  const filterKeys = (["all", "sent", "failed", "bounced", "pending"] as StatusKey[]).filter(
    (k) => k === "all" || counts[k] > 0,
  );

  return (
    <div className="flex h-full flex-col text-zinc-900">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="px-7 pt-6">
        <Link href="/dashboard/campaigns" className="text-[13px] text-zinc-500 hover:text-zinc-900">
          ← Back to campaigns
        </Link>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="truncate text-[22px] font-semibold tracking-tight">{campaign.name}</h1>
              <StatusBadge finished={finished} />
            </div>
            <p className="mt-1 truncate text-[13.5px] text-zinc-500">{campaign.subject}</p>
          </div>
        </div>
      </div>

      {/* ── Metrics ─────────────────────────────────────────────────── */}
      <div className="px-7 pt-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Recipients" value={total} tone="text-zinc-900" />
          <Metric label="Delivered" value={counts.sent} tone="text-emerald-600" />
          <Metric
            label="Opened"
            value={`${openRate}%`}
            hint={engagement ? `${engagement.opensUnique} unique` : "—"}
            tone="text-indigo-600"
            soft
          />
          <Metric
            label="Clicked"
            value={`${clickRate}%`}
            hint={engagement ? `${engagement.clicksUnique} unique` : "—"}
            tone="text-indigo-600"
            soft
          />
          <Metric
            label="Failed"
            value={counts.failed}
            tone={counts.failed > 0 ? "text-red-600" : "text-zinc-400"}
          />
          <Metric
            label="Bounced"
            value={counts.bounced}
            tone={counts.bounced > 0 ? "text-orange-600" : "text-zinc-400"}
          />
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          Delivered, failed &amp; bounced are exact. Opened &amp; clicked are estimates — privacy
          inboxes block or pre-fetch tracking, so the real numbers are at least this high.
        </p>

        {/* Progress / delivery-rate bar */}
        <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,.03)]">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-medium text-zinc-700">
              {finished ? `${deliveryRate}% delivered` : `Sending… ${done}/${total}`}
            </span>
            <span className="tabular-nums text-zinc-400">
              {finished ? `${counts.sent}/${total} delivered` : `${pct}%`}
            </span>
          </div>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-zinc-100">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                finished ? "bg-emerald-500" : "bg-amber-500"
              }`}
              style={{ width: `${finished ? deliveryRate : pct}%` }}
            />
          </div>
          {!finished && total > 0 && (
            <p className="mt-2.5 text-xs text-zinc-400">
              Live — updates every couple seconds as QStash delivers each batch to the worker.
            </p>
          )}
        </div>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 px-7 pb-3.5 pt-5">
        <div className="relative w-[300px]">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email…"
            className="h-[38px] w-full rounded-[9px] border border-zinc-200 bg-white pl-9 pr-3 text-[13.5px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
          />
        </div>
        <div className="flex items-center gap-2">
          {filterKeys.map((key) => {
            const active = statusFilter === key;
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`inline-flex h-[38px] items-center gap-1.5 rounded-[9px] border px-3.5 text-[13.5px] font-medium transition-colors ${
                  active
                    ? "border-indigo-300 bg-indigo-50 text-indigo-600"
                    : "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50"
                }`}
              >
                {key === "all" ? "All" : STATUS[key].label}
                <span
                  className={`text-xs font-semibold tabular-nums ${active ? "text-indigo-500" : "text-zinc-400"}`}
                >
                  {counts[key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Table card ──────────────────────────────────────────────── */}
      <div className="mx-7 mb-7 flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,.03)]">
        {/* Column header */}
        <div
          className="grid items-center border-b border-zinc-100 bg-[#fbfbfc] px-4 text-[11px] font-semibold uppercase tracking-[.04em] text-zinc-400"
          style={{ gridTemplateColumns: "minmax(200px,2fr) 120px 160px", height: 40 }}
        >
          <div>Recipient</div>
          <div>Status</div>
          <div>Sent</div>
        </div>

        {/* Rows */}
        {filtered.length > 0 ? (
          <div>
            {filtered.map((r, i) => {
              const [avBg, avFg] = AVATAR_COLORS[i % AVATAR_COLORS.length];
              const st = STATUS[r.status as keyof typeof STATUS] ?? {
                label: r.status,
                bg: "bg-zinc-100",
                fg: "text-zinc-600",
                dot: "bg-zinc-400",
              };
              return (
                <div
                  key={r.id}
                  className="group relative grid items-center border-b border-zinc-50 px-4 transition-colors hover:bg-zinc-50/70"
                  style={{ gridTemplateColumns: "minmax(200px,2fr) 120px 160px", height: 64 }}
                >
                  {/* Avatar + name + email */}
                  <div className="flex min-w-0 items-center gap-3 pr-3">
                    <div
                      className={`flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full text-[12.5px] font-semibold ${avBg} ${avFg}`}
                    >
                      {getInitials(r.name, r.email)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-medium text-zinc-900">
                        {r.name || r.email.split("@")[0]}
                      </div>
                      <div className="truncate text-[12.5px] text-zinc-400">{r.email}</div>
                    </div>
                  </div>

                  {/* Status pill */}
                  <div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${st.bg} ${st.fg}`}
                      title={r.error ?? undefined}
                    >
                      <span className={`h-1.5 w-1.5 flex-none rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                  </div>

                  {/* Sent time */}
                  <div className="truncate text-[13px] tabular-nums text-zinc-500" title={r.error ?? undefined}>
                    {r.status === "sent" ? formatSentAt(r.sentAt) : r.error ? "Not delivered" : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-100">
              <SearchIcon className="h-6 w-6 text-zinc-400" />
            </div>
            <div className="text-[15.5px] font-semibold text-zinc-800">
              {recipients.length === 0 ? "No recipients yet" : "No recipients match your filters"}
            </div>
            <div className="mt-1 max-w-[340px] text-[13.5px] text-zinc-400">
              {recipients.length === 0
                ? "This campaign hasn't been sent to anyone."
                : "Try a different search term, or clear the active status filter."}
            </div>
            {recipients.length > 0 && (
              <button
                onClick={() => {
                  setQuery("");
                  setStatusFilter("all");
                }}
                className="mt-4 rounded-[9px] border border-zinc-200 bg-white px-4 py-2 text-[13.5px] font-medium text-zinc-600 hover:bg-zinc-50"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-zinc-100 bg-[#fbfbfc] px-4 py-3">
          <div className="text-[12.5px] tabular-nums text-zinc-400">
            {query || statusFilter !== "all"
              ? `${filtered.length} recipient${filtered.length === 1 ? "" : "s"} match`
              : `${recipients.length} recipient${recipients.length === 1 ? "" : "s"}`}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ finished }: { finished: boolean }) {
  if (finished) {
    return (
      <span className="inline-flex flex-none items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Sent
      </span>
    );
  }
  return (
    <span className="inline-flex flex-none items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
      Sending
    </span>
  );
}

function Metric({
  label,
  value,
  tone,
  hint,
  soft,
}: {
  label: string;
  value: number | string;
  tone: string;
  hint?: string;
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
      {hint && <div className="mt-0.5 text-[11px] tabular-nums text-zinc-400">{hint}</div>}
    </div>
  );
}

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.4-3.4" />
    </svg>
  );
}

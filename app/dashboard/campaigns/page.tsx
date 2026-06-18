"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Campaign = {
  id: string;
  name: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  status: string;
  createdAt: string;
  sentAt: string | null;
  audienceCount: number;
  sentCount: number;
};

type StatusKey = "all" | "draft" | "sending" | "sent";

const STATUS = {
  draft: { label: "Draft", bg: "bg-zinc-100", fg: "text-zinc-600", dot: "bg-zinc-400" },
  sending: { label: "Sending", bg: "bg-amber-50", fg: "text-amber-700", dot: "bg-amber-500" },
  sent: { label: "Sent", bg: "bg-emerald-50", fg: "text-emerald-700", dot: "bg-emerald-500" },
} as const;

// Name | Status | Send to | Recipients | Created | chevron
const GRID = "minmax(220px,2.4fr) 130px 140px 120px 120px 36px";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function CampaignsPage() {
  const router = useRouter();
  const [list, setList] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setList(d.campaigns);
      })
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const c: Record<StatusKey, number> = { all: list.length, draft: 0, sending: 0, sent: 0 };
    list.forEach((x) => {
      if (x.status === "draft" || x.status === "sending" || x.status === "sent") c[x.status]++;
    });
    return c;
  }, [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (q && !`${c.name} ${c.subject}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [list, query, statusFilter]);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Campaigns</h1>
          <p className="mt-1 text-sm text-zinc-500">Every send and its status. Click one to see details.</p>
        </div>
        <Link
          href="/editor-new"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        >
          <PlusIcon /> Create
        </Link>
      </div>

      {/* Filter bar */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <SearchIcon />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search campaigns…"
            className="h-[38px] w-full rounded-[9px] border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-zinc-300"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {(["all", "draft", "sending", "sent"] as StatusKey[]).map((key) => {
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
                <span className={`text-xs font-semibold tabular-nums ${active ? "text-indigo-500" : "text-zinc-400"}`}>
                  {counts[key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="mt-5 overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div
          className="grid items-center border-b border-zinc-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-400"
          style={{ gridTemplateColumns: GRID }}
        >
          <span>Campaign</span>
          <span>Status</span>
          <span>Send to</span>
          <span>Recipients</span>
          <span>Created</span>
          <span />
        </div>

        {loading && <div className="px-4 py-12 text-center text-sm text-zinc-400">Loading…</div>}

        {!loading && filtered.length === 0 && (
          <div className="px-4 py-16 text-center">
            <p className="text-sm font-medium text-zinc-600">
              {list.length === 0 ? "No campaigns yet" : "No campaigns match your filters"}
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              {list.length === 0 ? (
                <>
                  Compose one in the{" "}
                  <Link href="/editor-new" className="text-indigo-600 hover:underline">
                    editor
                  </Link>
                  , then send it.
                </>
              ) : (
                "Try a different search or status."
              )}
            </p>
          </div>
        )}

        {!loading &&
          filtered.map((c) => {
            const tone = STATUS[c.status as keyof typeof STATUS] ?? STATUS.draft;
            const isDraft = c.status === "draft";
            return (
              <button
                key={c.id}
                onClick={() => router.push(`/dashboard/campaigns/${c.id}`)}
                className="grid w-full items-center border-b border-zinc-50 px-4 text-left transition-colors last:border-0 hover:bg-zinc-50/70"
                style={{ gridTemplateColumns: GRID, height: 64 }}
              >
                {/* Name */}
                <div className="flex min-w-0 items-center gap-3 pr-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                    <MailIcon />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-zinc-800">
                      {c.name || "Untitled Campaign"}
                    </div>
                    <div className="truncate text-xs text-zinc-400">{c.subject || "No subject"}</div>
                  </div>
                </div>

                {/* Status */}
                <div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tone.bg} ${tone.fg}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                    {tone.label}
                  </span>
                </div>

                {/* Send to */}
                <div className="text-sm text-zinc-500">All contacts</div>

                {/* Recipients */}
                <div className="text-sm tabular-nums text-zinc-600">
                  {isDraft ? (
                    <span className="text-zinc-300">—</span>
                  ) : (
                    <span>
                      {c.sentCount}
                      <span className="text-zinc-400">/{c.audienceCount}</span>
                    </span>
                  )}
                </div>

                {/* Created */}
                <div className="text-xs text-zinc-400">{formatDate(c.createdAt)}</div>

                {/* Chevron */}
                <div className="flex justify-end text-zinc-300">
                  <ChevronIcon />
                </div>
              </button>
            );
          })}
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

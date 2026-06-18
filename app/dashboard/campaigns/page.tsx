"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PREBUILT_TEMPLATES } from "@/lib/email/templates";

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

// checkbox | Name | Status | Send to | Recipients | Created | chevron
const GRID = "40px minmax(200px,2.4fr) 130px 140px 110px 110px 36px";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function CampaignsPage() {
  const router = useRouter();
  const [list, setList] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} campaign${ids.length === 1 ? "" : "s"}? This can't be undone.`)) {
      return;
    }
    const results = await Promise.all(
      ids.map((id) =>
        fetch(`/api/campaigns/${id}`, { method: "DELETE" })
          .then((r) => r.json())
          .then((d) => ({ id, ok: Boolean(d.ok) }))
          .catch(() => ({ id, ok: false })),
      ),
    );
    const deleted = new Set(results.filter((r) => r.ok).map((r) => r.id));
    setList((prev) => prev.filter((c) => !deleted.has(c.id)));
    setSelected(new Set());
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (q && !`${c.name} ${c.subject}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [list, query, statusFilter]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      const ids = filtered.map((c) => c.id);
      const allOn = ids.length > 0 && ids.every((id) => next.has(id));
      ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Campaigns</h1>
          <p className="mt-1 text-sm text-zinc-500">Every send and its status. Click one to see details.</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
        >
          <PlusIcon /> Create
        </button>
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

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5">
          <span className="text-sm font-medium text-indigo-700">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-3">
            <button onClick={() => setSelected(new Set())} className="text-sm font-medium text-indigo-600 hover:underline">
              Clear
            </button>
            <button
              onClick={handleBulkDelete}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              <TrashIcon /> Delete
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="mt-5 overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div
          className="grid items-center border-b border-zinc-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-400"
          style={{ gridTemplateColumns: GRID }}
        >
          <Checkbox checked={allVisibleSelected} onChange={toggleAll} />
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
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/dashboard/campaigns/${c.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") router.push(`/dashboard/campaigns/${c.id}`);
                }}
                className={`group grid w-full cursor-pointer items-center border-b border-zinc-50 px-4 text-left transition-colors last:border-0 ${
                  selected.has(c.id) ? "bg-indigo-50/50" : "hover:bg-zinc-50/70"
                }`}
                style={{ gridTemplateColumns: GRID, height: 64 }}
              >
                {/* Checkbox */}
                <div onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} />
                </div>

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
              </div>
            );
          })}
      </div>

      {createOpen && <CreateCampaignModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

// ── Create campaign modal ────────────────────────────────────────────────────

function CreateCampaignModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const defaultName = useMemo(
    () =>
      `Email Campaign - ${new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`,
    [],
  );
  const [name, setName] = useState(defaultName);
  const [templateId, setTemplateId] = useState("blank");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "Untitled Campaign", templateId }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Could not create campaign");
        setCreating(false);
        return;
      }
      router.push(`/dashboard/campaigns/${data.id}`);
    } catch {
      setError("Could not reach the server.");
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-zinc-900/40" aria-hidden onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h2 className="text-base font-semibold text-zinc-800">Create a new email</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <CloseIcon />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* Type — only Regular for now */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500">Type</label>
            <div className="flex items-start gap-3 rounded-lg border border-zinc-900 bg-zinc-50/60 p-3">
              <div className="mt-0.5 text-zinc-700">
                <MailIcon />
              </div>
              <div>
                <div className="text-sm font-medium text-zinc-800">Regular email</div>
                <p className="text-xs text-zinc-500">
                  Design an on-brand email to promote a product, announce an event, or share news.
                </p>
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <label htmlFor="campaign-name" className="mb-1.5 block text-xs font-medium text-zinc-500">
              Internal name
            </label>
            <input
              id="campaign-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-800 outline-none focus:border-zinc-300"
            />
          </div>

          {/* Template */}
          <div>
            <label htmlFor="campaign-template" className="mb-1.5 block text-xs font-medium text-zinc-500">
              Start from
            </label>
            <select
              id="campaign-template"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-800 outline-none focus:border-zinc-300"
            >
              <option value="blank">Blank — start from scratch</option>
              {PREBUILT_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4">
          <button
            onClick={onClose}
            className="h-9 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            onClick={create}
            disabled={creating}
            className="h-9 rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
          >
            {creating ? "Creating…" : "Begin"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
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

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6M14 11v6" />
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

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={`flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border-[1.5px] text-[11px] font-bold transition-colors ${
        checked
          ? "border-indigo-600 bg-indigo-600 text-white"
          : "border-zinc-300 bg-white text-transparent hover:border-zinc-400"
      }`}
      aria-label="Select"
    >
      ✓
    </button>
  );
}

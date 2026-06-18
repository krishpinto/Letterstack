"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Recipient = {
  id: string;
  email: string;
  name: string | null;
  sentAt: string | null;
  createdAt: string;
};
type SuppressedEntry = { email: string; reason: string };
type Contact = Recipient & { status: "subscribed" | "bounced" | "suppressed" };
type StatusKey = "all" | "subscribed" | "bounced" | "suppressed";

const STATUS = {
  subscribed: { label: "Subscribed", bg: "bg-emerald-50", fg: "text-emerald-700", dot: "bg-emerald-500" },
  bounced: { label: "Bounced", bg: "bg-orange-50", fg: "text-orange-700", dot: "bg-orange-500" },
  suppressed: { label: "Suppressed", bg: "bg-zinc-100", fg: "text-zinc-500", dot: "bg-zinc-400" },
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addName, setAddName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const load = useCallback(async () => {
    const [rRes, sRes] = await Promise.all([
      fetch("/api/lab/recipients").then((r) => r.json()),
      fetch("/api/lab/suppression").then((r) => r.json()),
    ]);
    if (!rRes.ok || !sRes.ok) return;
    const suppMap = new Map<string, string>();
    (sRes.suppressed as SuppressedEntry[]).forEach((s) => suppMap.set(s.email, s.reason));
    const merged: Contact[] = (rRes.recipients as Recipient[]).map((r) => {
      const reason = suppMap.get(r.email);
      let status: Contact["status"] = "subscribed";
      if (reason === "bounce" || reason === "complaint") status = "bounced";
      else if (reason) status = "suppressed";
      return { ...r, status };
    });
    setContacts(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (q && !`${c.name || ""} ${c.email}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [contacts, query, statusFilter]);

  const counts = useMemo(() => {
    const c = { all: contacts.length, subscribed: 0, bounced: 0, suppressed: 0 };
    contacts.forEach((r) => c[r.status]++);
    return c;
  }, [contacts]);

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const ids = filtered.map((c) => c.id);
    const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const removeContact = async (id: string) => {
    const res = await fetch(`/api/lab/recipients?id=${id}`, { method: "DELETE" }).then((r) => r.json());
    if (res.ok) {
      showToast("Contact removed");
      setSelected((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      await load();
    }
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    for (const id of ids) await fetch(`/api/lab/recipients?id=${id}`, { method: "DELETE" });
    showToast(`${ids.length} contact${ids.length === 1 ? "" : "s"} removed`);
    clearSelection();
    await load();
  };

  const bulkSuppress = async () => {
    const emails = contacts.filter((c) => selected.has(c.id)).map((c) => c.email);
    for (const email of emails)
      await fetch("/api/lab/suppression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    showToast(`${emails.length} contact${emails.length === 1 ? "" : "s"} suppressed`);
    clearSelection();
    await load();
  };

  const addContact = async () => {
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/lab/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addEmail, name: addName || undefined }),
      }).then((r) => r.json());
      if (!res.ok) {
        setAddError(res.error);
        return;
      }
      setAddEmail("");
      setAddName("");
      setAddOpen(false);
      showToast("Contact added");
      await load();
    } finally {
      setAdding(false);
    }
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const someFilteredSelected = filtered.some((c) => selected.has(c.id));

  if (loading) return <div className="p-8 text-sm text-zinc-400">Loading contacts…</div>;

  return (
    <div className="flex h-full flex-col text-zinc-900">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="px-7 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">Contacts</h1>
            <div className="mt-1 text-[13.5px] text-zinc-500">
              <span className="font-semibold tabular-nums text-zinc-700">{contacts.length} contacts</span>
              <span className="mx-2 text-zinc-300">·</span>
              {counts.subscribed} subscribed · {counts.bounced} bounced · {counts.suppressed} suppressed
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button className={outlineBtn}>
              <ExportIcon />
              Export
            </button>
            <button onClick={() => setAddOpen(true)} className={primaryBtn}>
              <PlusIcon />
              Add recipients
            </button>
          </div>
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
          {(["all", "subscribed", "bounced", "suppressed"] as StatusKey[]).map((key) => {
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

      {/* ── Table card ──────────────────────────────────────────────── */}
      <div className="mx-7 mb-7 flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,.03)]">
        {/* Selection bar */}
        {selected.size > 0 && (
          <div className="flex items-center justify-between gap-4 border-b border-indigo-200 bg-indigo-50 px-4 py-2.5">
            <span className="text-[13.5px] font-semibold text-indigo-600">
              {selected.size} selected
            </span>
            <div className="flex items-center gap-2">
              <BulkBtn onClick={bulkSuppress}>
                <SuppressIcon />
                Suppress
              </BulkBtn>
              <BulkBtn onClick={bulkDelete} danger>
                <TrashIcon />
                Delete
              </BulkBtn>
              <div className="mx-0.5 h-5 w-px bg-indigo-200" />
              <button
                onClick={clearSelection}
                className="flex h-[30px] w-[30px] items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                title="Clear selection"
              >
                <XIcon />
              </button>
            </div>
          </div>
        )}

        {/* Column header */}
        <div
          className="grid items-center border-b border-zinc-100 bg-[#fbfbfc] px-4 text-[11px] font-semibold uppercase tracking-[.04em] text-zinc-400"
          style={{ gridTemplateColumns: "46px minmax(200px,2fr) 120px 100px 88px", height: 40 }}
        >
          <div className="flex items-center justify-center">
            <Checkbox checked={allFilteredSelected} indeterminate={someFilteredSelected && !allFilteredSelected} onClick={toggleAll} />
          </div>
          <div>Name</div>
          <div>Status</div>
          <div>Added</div>
          <div className="text-right">Actions</div>
        </div>

        {/* Rows */}
        {filtered.length > 0 ? (
          <div>
            {filtered.map((c, i) => {
              const isSelected = selected.has(c.id);
              const isHovered = hoverId === c.id;
              const [avBg, avFg] = AVATAR_COLORS[i % AVATAR_COLORS.length];
              const st = STATUS[c.status];
              return (
                <div
                  key={c.id}
                  onMouseEnter={() => setHoverId(c.id)}
                  onMouseLeave={() => hoverId === c.id && setHoverId(null)}
                  className={`group relative grid items-center border-b border-zinc-50 px-4 transition-colors ${
                    isSelected ? "bg-indigo-50/50" : isHovered ? "bg-zinc-50/70" : ""
                  }`}
                  style={{ gridTemplateColumns: "46px minmax(200px,2fr) 120px 100px 88px", height: 64 }}
                >
                  {/* Checkbox */}
                  <div className="flex items-center justify-center">
                    <Checkbox checked={isSelected} onClick={() => toggleRow(c.id)} />
                  </div>

                  {/* Avatar + name + email */}
                  <div className="flex min-w-0 items-center gap-3 pr-3">
                    <div className={`flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full text-[12.5px] font-semibold ${avBg} ${avFg}`}>
                      {getInitials(c.name, c.email)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-medium text-zinc-900">
                        {c.name || c.email.split("@")[0]}
                      </div>
                      <div className="truncate text-[12.5px] text-zinc-400">{c.email}</div>
                    </div>
                  </div>

                  {/* Status pill */}
                  <div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${st.bg} ${st.fg}`}>
                      <span className={`h-1.5 w-1.5 flex-none rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                  </div>

                  {/* Date */}
                  <div className="text-[13px] tabular-nums text-zinc-500">{formatDate(c.createdAt)}</div>

                  {/* Hover actions */}
                  <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => removeContact(c.id)}
                      className="flex h-[30px] w-[30px] items-center justify-center rounded-[7px] border border-transparent text-zinc-400 hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                      title="Remove contact"
                    >
                      <TrashIcon />
                    </button>
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
            <div className="text-[15.5px] font-semibold text-zinc-800">No contacts match your filters</div>
            <div className="mt-1 max-w-[340px] text-[13.5px] text-zinc-400">
              Try a different search term, or clear the active status filter to see everyone.
            </div>
            <button
              onClick={() => { setQuery(""); setStatusFilter("all"); }}
              className="mt-4 rounded-[9px] border border-zinc-200 bg-white px-4 py-2 text-[13.5px] font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-zinc-100 bg-[#fbfbfc] px-4 py-3">
          <div className="text-[12.5px] tabular-nums text-zinc-400">
            {query || statusFilter !== "all"
              ? `${filtered.length} contact${filtered.length === 1 ? "" : "s"} match`
              : `${contacts.length} contact${contacts.length === 1 ? "" : "s"}`}
          </div>
        </div>
      </div>

      {/* ── Add Contact Modal ───────────────────────────────────────── */}
      {addOpen && (
        <div onClick={() => setAddOpen(false)} className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-[2px]" style={{ animation: "ls-pop .14s ease" }}>
          <div onClick={(e) => e.stopPropagation()} className="w-[480px] max-w-[92vw] rounded-2xl bg-white shadow-2xl" style={{ animation: "ls-pop .18s cubic-bezier(.2,.8,.3,1)" }}>
            <div className="flex items-center justify-between px-5 pt-5">
              <h2 className="text-[17px] font-semibold">Add recipient</h2>
              <button onClick={() => setAddOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
                <XIcon />
              </button>
            </div>
            <div className="space-y-3 px-5 pb-5 pt-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Email</label>
                <input
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="email@example.com"
                  className={modalInput}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && addEmail.trim() && addContact()}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Name (optional)</label>
                <input
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="Jane Doe"
                  className={modalInput}
                  onKeyDown={(e) => e.key === "Enter" && addEmail.trim() && addContact()}
                />
              </div>
              {addError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">{addError}</div>
              )}

              {/* Divider + import hint */}
              <div className="flex items-center gap-3 pt-1">
                <div className="h-px flex-1 bg-zinc-100" />
                <span className="text-xs text-zinc-300">or</span>
                <div className="h-px flex-1 bg-zinc-100" />
              </div>
              <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[9px] border border-zinc-200 bg-white py-2.5 text-[13.5px] font-medium text-zinc-600 hover:bg-zinc-50">
                <UploadIcon />
                Import CSV / XLSX
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) showToast(`Selected "${file.name}" — import parsing coming soon.`);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2.5 border-t border-zinc-100 bg-[#fbfbfc] px-5 py-3.5 rounded-b-2xl">
              <button onClick={() => setAddOpen(false)} className={outlineBtn}>
                Cancel
              </button>
              <button onClick={addContact} disabled={adding || !addEmail.trim()} className={primaryBtn}>
                {adding ? "Adding…" : "Add contact"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ───────────────────────────────────────────────────── */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-[60] flex items-center gap-2.5 rounded-xl bg-zinc-900 px-4 py-3 text-[13.5px] font-medium text-white shadow-lg"
          style={{ animation: "ls-rise .2s cubic-bezier(.2,.8,.3,1)" }}
        >
          <span className="h-[7px] w-[7px] flex-none rounded-full bg-emerald-400" />
          {toast}
        </div>
      )}
    </div>
  );
}

/* ── Shared styles ──────────────────────────────────────────────────── */

const outlineBtn =
  "inline-flex h-[38px] items-center gap-[7px] rounded-[9px] border border-zinc-200 bg-white px-3.5 text-[13.5px] font-medium text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300";
const primaryBtn =
  "inline-flex h-[38px] items-center gap-[7px] rounded-[9px] border-none bg-indigo-600 px-4 text-[13.5px] font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50";
const modalInput =
  "w-full rounded-[9px] border border-zinc-200 bg-white px-3 py-2.5 text-[13.5px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100";

/* ── Sub-components ─────────────────────────────────────────────────── */

function Checkbox({ checked, indeterminate, onClick }: { checked: boolean; indeterminate?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border-[1.5px] text-[11px] font-bold transition-colors ${
        checked || indeterminate
          ? "border-indigo-600 bg-indigo-600 text-white"
          : "border-zinc-300 bg-white text-transparent hover:border-zinc-400"
      }`}
    >
      {checked ? "✓" : indeterminate ? "–" : ""}
    </button>
  );
}

function BulkBtn({ onClick, children, danger }: { onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium ${
        danger ? "border-red-200 text-red-600 hover:bg-red-50" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
      }`}
    >
      {children}
    </button>
  );
}

/* ── Icons ──────────────────────────────────────────────────────────── */

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.4-3.4" />
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

function ExportIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 19h14" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 16v3h14v-3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
    </svg>
  );
}

function SuppressIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6.2 6.2 17.8 17.8" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

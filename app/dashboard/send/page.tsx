"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// The Send workspace — the product version of the recipients / campaign /
// suppression lab cards. It reuses the same backend endpoints (/api/lab/*),
// just presented as a real page. (Endpoints get renamed off /lab later.)

type Recipient = {
  id: string;
  email: string;
  name: string | null;
  sentAt: string | null;
  createdAt: string;
};
type Suppressed = { id: string; email: string; reason: string; createdAt: string };

export default function SendPage() {
  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Send</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Manage your audience, fire a campaign, and keep your do-not-mail list.
        </p>
      </div>
      <RecipientsSection />
      <CampaignSection />
      <SuppressionSection />
    </div>
  );
}

// ── Recipients ────────────────────────────────────────────────────────────────

function RecipientsSection() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [list, setList] = useState<Recipient[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);

  async function load() {
    const data = await (await fetch("/api/lab/recipients")).json();
    if (data.ok) setList(data.recipients);
  }
  useEffect(() => {
    load();
  }, []);

  async function add() {
    setSaving(true);
    setError(null);
    try {
      const data = await (
        await fetch("/api/lab/recipients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, name }),
        })
      ).json();
      if (!data.ok) setError(data.error);
      else {
        setEmail("");
        setName("");
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const data = await (
      await fetch(`/api/lab/recipients?id=${id}`, { method: "DELETE" })
    ).json();
    if (!data.ok) setError(data.error);
    await load();
  }

  return (
    <Card title="Recipients" subtitle={`${list.length} contact${list.length === 1 ? "" : "s"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" className={inputCls} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" className={inputCls} />
        <button onClick={add} disabled={saving} className={btnDark}>
          {saving ? "Adding…" : "Add"}
        </button>

        <span className="text-xs text-zinc-300">or</span>

        {/* Import option — UI only for now; the CSV/XLSX parsing is wired later. */}
        <label className="cursor-pointer rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50">
          Import CSV/XLSX
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setImportNote(`Selected "${file.name}" — import parsing coming soon.`);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {importNote && (
        <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
          {importNote}
        </div>
      )}
      {error && <ErrorBox>{error}</ErrorBox>}
      <ul className="mt-4 divide-y divide-zinc-100">
        {list.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium text-zinc-800">{r.email}</span>
            <span className="text-zinc-500">{r.name || "—"}</span>
            <button
              onClick={() => remove(r.id)}
              className="rounded px-1.5 text-zinc-300 hover:bg-red-50 hover:text-red-500"
              title="Remove"
            >
              ✕
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="py-2 text-sm text-zinc-400">No recipients yet.</li>}
      </ul>
    </Card>
  );
}

// ── Campaign ──────────────────────────────────────────────────────────────────

function CampaignSection() {
  return (
    <Card title="Send campaign" subtitle="Goes out in batches through QStash → SES">
      <p className="text-sm text-zinc-500">
        Review exactly what goes out — recipients, sender, subject, and a full
        preview of the email you composed in the{" "}
        <Link href="/editor-new" className="font-medium text-zinc-900 underline">
          editor
        </Link>{" "}
        — before anything sends.
      </p>
      <Link
        href="/dashboard/send/review"
        className="mt-4 inline-block rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
      >
        Review &amp; send →
      </Link>
    </Card>
  );
}

// ── Suppression ───────────────────────────────────────────────────────────────

function SuppressionSection() {
  const [email, setEmail] = useState("");
  const [list, setList] = useState<Suppressed[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const data = await (await fetch("/api/lab/suppression")).json();
    if (data.ok) setList(data.suppressed);
  }
  useEffect(() => {
    load();
  }, []);

  async function add() {
    setSaving(true);
    setError(null);
    try {
      const data = await (
        await fetch("/api/lab/suppression", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        })
      ).json();
      if (!data.ok) setError(data.error);
      else {
        setEmail("");
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Do-not-mail list" subtitle="Never sent to — checked before every email">
      <div className="flex flex-wrap gap-2">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" className={inputCls} />
        <button onClick={add} disabled={saving} className={btnRose}>
          {saving ? "Adding…" : "Suppress"}
        </button>
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
      <ul className="mt-4 divide-y divide-zinc-100">
        {list.map((s) => (
          <li key={s.id} className="flex items-center justify-between py-2 text-sm">
            <span className="font-medium text-zinc-800">{s.email}</span>
            <Badge tone="zinc">{s.reason}</Badge>
          </li>
        ))}
        {list.length === 0 && <li className="py-2 text-sm text-zinc-400">List is empty.</li>}
      </ul>
    </Card>
  );
}

// ── shared bits ───────────────────────────────────────────────────────────────

const inputCls =
  "flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-zinc-500";
const btnDark = "rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50";
const btnRose = "rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50";

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="mb-3">
        <h2 className="font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-zinc-400">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Badge({ tone, children }: { tone: "green" | "zinc"; children: React.ReactNode }) {
  const cls = tone === "green" ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">✕ {children}</div>;
}

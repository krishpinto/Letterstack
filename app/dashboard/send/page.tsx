"use client";

import { useEffect, useState } from "react";

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
type Summary = { totalUnsent: number; batches: number };

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

  return (
    <Card title="Recipients" subtitle={`${list.length} contact${list.length === 1 ? "" : "s"}`}>
      <div className="flex flex-wrap gap-2">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" className={inputCls} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" className={inputCls} />
        <button onClick={add} disabled={saving} className={btnDark}>
          {saving ? "Adding…" : "Add"}
        </button>
      </div>
      {error && <ErrorBox>{error}</ErrorBox>}
      <ul className="mt-4 divide-y divide-zinc-100">
        {list.map((r) => (
          <li key={r.id} className="flex items-center justify-between py-2 text-sm">
            <span className="font-medium text-zinc-800">{r.email}</span>
            <span className="flex items-center gap-2 text-zinc-500">
              {r.name || "—"}
              {r.sentAt && <Badge tone="green">sent</Badge>}
            </span>
          </li>
        ))}
        {list.length === 0 && <li className="py-2 text-sm text-zinc-400">No recipients yet.</li>}
      </ul>
    </Card>
  );
}

// ── Campaign ──────────────────────────────────────────────────────────────────

function CampaignSection() {
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setStatus("sending");
    setSummary(null);
    setError(null);
    try {
      const data = await (await fetch("/api/lab/send-campaign", { method: "POST" })).json();
      if (!data.ok) setError(data.error);
      else setSummary(data.summary);
    } finally {
      setStatus("idle");
    }
  }

  async function reset() {
    await fetch("/api/lab/reset-sent", { method: "POST" });
    setSummary(null);
  }

  return (
    <Card title="Send campaign" subtitle="Goes out in batches through QStash → SES">
      <p className="text-sm text-zinc-500">
        Sends the newsletter to everyone not already emailed (skipping suppressed
        addresses). Refresh to watch the &quot;sent&quot; badges fill in above.
      </p>
      <div className="mt-4 flex gap-2">
        <button onClick={send} disabled={status === "sending"} className={btnAmber}>
          {status === "sending" ? "Sending…" : "Send campaign"}
        </button>
        <button onClick={reset} className={btnGhost}>
          Reset sent flags
        </button>
      </div>
      {summary && summary.totalUnsent === 0 && (
        <InfoBox>Nothing to send — everyone has already received it.</InfoBox>
      )}
      {summary && summary.totalUnsent > 0 && (
        <SuccessBox>
          Queued <strong>{summary.batches}</strong> batch{summary.batches === 1 ? "" : "es"} (
          {summary.totalUnsent} people). Sending in the background — refresh to watch.
        </SuccessBox>
      )}
      {error && <ErrorBox>{error}</ErrorBox>}
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
  "flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500";
const btnDark = "rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50";
const btnAmber = "rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50";
const btnRose = "rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50";
const btnGhost = "rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50";

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
function SuccessBox({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">✔ {children}</div>;
}
function InfoBox({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">{children}</div>;
}

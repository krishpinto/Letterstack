"use client"; // This page runs in the browser (it has a clickable button + state).

import { useEffect, useState } from "react";

// The shape of what our server endpoint sends back.
type SendResult =
  | { ok: true; messageId: string; to: string; fromEmail: string }
  | { ok: false; error: string };

/**
 * /lab — our learning dashboard.
 *
 * Think of this page as a visual table of contents for the mailing system.
 * Every time we build a "box" of the mailroom, it gets one card here that
 * explains what it is and lets you poke at it. First card: the SES courier.
 */
export default function LabPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-bold">LetterStack — Lab</h1>
      <p className="mt-1 text-sm text-zinc-500">
        A visual table of contents for the mailing system. Each card below is one
        piece we&apos;ve actually built — poke at it to see it work.
      </p>

      <div className="mt-8 space-y-6">
        <SesCourierCard />
        <DatabaseCard />
        <RecipientsCard />
        <SuppressionCard />
        <CampaignCard />
        <QStashCard />
      </div>
    </main>
  );
}

/** Box #2 of the mailroom map: hand one email to Amazon SES. */
function SesCourierCard() {
  // Track what's happening so the UI can react: idle → sending → result.
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [result, setResult] = useState<SendResult | null>(null);

  async function handleSend() {
    setStatus("sending");
    setResult(null);
    try {
      // The browser ASKS the server endpoint to do the secret work.
      const res = await fetch("/api/lab/send-test", { method: "POST" });
      // The endpoint replies with JSON — either success + MessageId, or an error.
      setResult((await res.json()) as SendResult);
    } catch {
      setResult({ ok: false, error: "Could not reach the server endpoint." });
    } finally {
      setStatus("idle");
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
          Box #2
        </span>
        <h2 className="font-semibold">The SES courier</h2>
      </div>

      <p className="mt-2 text-sm text-zinc-600">
        This hands <strong>one</strong> email to Amazon SES, which actually
        delivers it to the inbox. The button below calls a small server endpoint
        that runs our <code className="rounded bg-zinc-100 px-1">sendEmail()</code>{" "}
        function — secrets stay on the server, never in this page.
      </p>

      <button
        onClick={handleSend}
        disabled={status === "sending"}
        className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {status === "sending" ? "Sending…" : "Send test email"}
      </button>

      {/* The result area — shows SES's MessageId on success, or the error. */}
      {result?.ok && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          ✔ Accepted by SES. Sent to <strong>{result.to}</strong> from{" "}
          <strong>{result.fromEmail}</strong>.
          <div className="mt-1 font-mono text-xs text-emerald-700">
            MessageId: {result.messageId}
          </div>
          <div className="mt-1 text-xs text-emerald-700">
            Check your inbox (and spam) — delivery is usually seconds.
          </div>
        </div>
      )}

      {result && !result.ok && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          ✕ Failed: {result.error}
        </div>
      )}
    </section>
  );
}

/** One row on the do-not-mail list. */
type Suppressed = {
  id: string;
  email: string;
  reason: string;
  createdAt: string;
};

/** Box #6: the do-not-mail list. Anything here is never emailed. */
function SuppressionCard() {
  const [email, setEmail] = useState("");
  const [list, setList] = useState<Suppressed[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/lab/suppression");
    const data = await res.json();
    if (data.ok) setList(data.suppressed);
    else setError(data.error);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/lab/suppression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error);
        return;
      }
      setEmail("");
      await load();
    } catch {
      setError("Could not reach the server endpoint.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
          Box #6
        </span>
        <h2 className="font-semibold">The do-not-mail list (suppression)</h2>
      </div>

      <p className="mt-2 text-sm text-zinc-600">
        Any address here is <strong>never sent to</strong> — the worker checks
        this before every email. Add one of your recipient addresses below, then
        run a campaign and watch it get skipped (it won&apos;t get a &quot;sent&quot;
        badge and no email arrives).
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
        />
        <button
          onClick={handleAdd}
          disabled={saving}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Adding…" : "Suppress"}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          ✕ {error}
        </div>
      )}

      <ul className="mt-4 divide-y divide-zinc-100">
        {list.map((s) => (
          <li key={s.id} className="flex items-center justify-between py-2 text-sm">
            <span className="font-medium text-zinc-800">{s.email}</span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
              {s.reason}
            </span>
          </li>
        ))}
        {list.length === 0 && (
          <li className="py-2 text-sm text-zinc-400">List is empty.</li>
        )}
      </ul>
    </section>
  );
}

/** Box #3 (the dispatcher): prove QStash can call back into your app. */
function QStashCard() {
  const [status, setStatus] = useState<"idle" | "working">("idle");
  const [published, setPublished] = useState<string | null>(null);
  const [ring, setRing] = useState<{ at: string; payload: unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRing() {
    setStatus("working");
    setPublished(null);
    setRing(null);
    setError(null);
    const clickedAt = Date.now();

    try {
      // 1. Ask our trigger to hand QStash a job.
      const res = await fetch("/api/lab/qstash-test", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error);
        return;
      }
      setPublished(data.messageId);

      // 2. QStash delivers a beat later, so check the doorbell a few times
      //    until we see a ring newer than our click.
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 600));
        const d = await (await fetch("/api/lab/qstash-doorbell")).json();
        if (d.ring && new Date(d.ring.at).getTime() >= clickedAt) {
          setRing(d.ring);
          break;
        }
      }
    } catch {
      setError("Could not reach the server endpoint.");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
          Box #3
        </span>
        <h2 className="font-semibold">The dispatcher (QStash)</h2>
      </div>

      <p className="mt-2 text-sm text-zinc-600">
        Hands QStash one job, then waits for QStash to <strong>ring your app
        back</strong>. Proves the round-trip works — the part we were unsure
        about. (No emails involved.) The local QStash dev server must be running.
      </p>

      <button
        onClick={handleRing}
        disabled={status === "working"}
        className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {status === "working" ? "Working…" : "Ring my app through QStash"}
      </button>

      {published && !ring && !error && (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
          Published to QStash (id: <span className="font-mono text-xs">{published}</span>).
          Waiting for the callback…
        </div>
      )}

      {ring && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          🔔 QStash called your doorbell at{" "}
          <span className="font-mono text-xs">{ring.at}</span> with payload:
          <pre className="mt-1 overflow-x-auto rounded bg-emerald-100/60 p-2 text-xs">
            {JSON.stringify(ring.payload, null, 2)}
          </pre>
          That&apos;s the full round-trip working.
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          ✕ Failed: {error}
        </div>
      )}
    </section>
  );
}

/** What the trigger returns now: how many batches it queued to QStash. */
type SendSummary = {
  totalUnsent: number;
  batches: number;
};

/** Box #1 (the milestone): send the newsletter to EVERYONE in the table. */
function CampaignCard() {
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [result, setResult] = useState<
    { ok: true; summary: SendSummary } | { ok: false; error: string } | null
  >(null);

  async function handleSend() {
    setStatus("sending");
    setResult(null);
    try {
      const res = await fetch("/api/lab/send-campaign", { method: "POST" });
      setResult(await res.json());
    } catch {
      setResult({ ok: false, error: "Could not reach the server endpoint." });
    } finally {
      setStatus("idle");
    }
  }

  async function handleReset() {
    await fetch("/api/lab/reset-sent", { method: "POST" });
    setResult(null);
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
          Campaign
        </span>
        <h2 className="font-semibold">Send to the whole list</h2>
      </div>

      <p className="mt-2 text-sm text-zinc-600">
        Splits the unsent people into batches and hands each to <strong>QStash</strong>,
        which calls the worker endpoint to send them — in the background. The
        button returns right away; refresh the recipients list to watch the
        &quot;sent&quot; badges appear. (QStash dev server must be running.)
      </p>

      <div className="mt-4 flex gap-2">
        <button
          onClick={handleSend}
          disabled={status === "sending"}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {status === "sending" ? "Sending…" : "Send campaign"}
        </button>
        <button
          onClick={handleReset}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
        >
          Reset sent flags
        </button>
      </div>

      {result?.ok && result.summary.totalUnsent === 0 && (
        <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
          Nothing to send — everyone has already received it. That&apos;s the
          checklist working: no double-sends. (Hit <em>Reset sent flags</em> to
          replay.)
        </div>
      )}

      {result?.ok && result.summary.totalUnsent > 0 && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          ✔ Queued <strong>{result.summary.batches}</strong>{" "}
          {result.summary.batches === 1 ? "batch" : "batches"} (
          {result.summary.totalUnsent} people) to QStash. Sending now in the
          background — <strong>refresh the page</strong> to watch the
          &quot;sent&quot; badges appear on the recipients above.
        </div>
      )}

      {result && !result.ok && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          ✕ Failed: {result.error}
        </div>
      )}
    </section>
  );
}

/** One row in the recipients table, as it comes back from the database. */
type Recipient = {
  id: string;
  email: string;
  name: string | null;
  sentAt: string | null;
  createdAt: string;
};

/** The recipients table — write a row (add a person) and read the list back. */
function RecipientsCard() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [list, setList] = useState<Recipient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Read the current list. Runs once when the card first appears, and again
  // after each successful add.
  async function load() {
    const res = await fetch("/api/lab/recipients");
    const data = await res.json();
    if (data.ok) setList(data.recipients);
    else setError(data.error);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/lab/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error);
        return;
      }
      setEmail("");
      setName("");
      await load(); // re-read so the new row shows up
    } catch {
      setError("Could not reach the server endpoint.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
          Box #4 · drawer 1
        </span>
        <h2 className="font-semibold">The recipients table</h2>
      </div>

      <p className="mt-2 text-sm text-zinc-600">
        Add a person below (a <em>write</em>), and the list underneath re-reads
        from the database (a <em>read</em>). This is real data living in Neon.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (optional)"
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
        />
        <button
          onClick={handleAdd}
          disabled={saving}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Add"}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          ✕ {error}
        </div>
      )}

      <div className="mt-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          {list.length} {list.length === 1 ? "recipient" : "recipients"}
        </div>
        <ul className="mt-2 divide-y divide-zinc-100">
          {list.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2 text-sm">
              <span className="font-medium text-zinc-800">{r.email}</span>
              <span className="flex items-center gap-2 text-zinc-500">
                {r.name || "—"}
                {r.sentAt && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    sent
                  </span>
                )}
              </span>
            </li>
          ))}
          {list.length === 0 && (
            <li className="py-2 text-sm text-zinc-400">No recipients yet.</li>
          )}
        </ul>
      </div>
    </section>
  );
}

/** Box #4 of the mailroom map: the Neon database — here we just prove it connects. */
function DatabaseCard() {
  const [status, setStatus] = useState<"idle" | "checking">("idle");
  const [result, setResult] = useState<
    { ok: true; time: string } | { ok: false; error: string } | null
  >(null);

  async function handlePing() {
    setStatus("checking");
    setResult(null);
    try {
      // A read, so GET (the default fetch method).
      const res = await fetch("/api/lab/db-ping");
      setResult(await res.json());
    } catch {
      setResult({ ok: false, error: "Could not reach the server endpoint." });
    } finally {
      setStatus("idle");
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
          Box #4
        </span>
        <h2 className="font-semibold">The database (Neon)</h2>
      </div>

      <p className="mt-2 text-sm text-zinc-600">
        Our filing cabinet in the cloud. No drawers (tables) yet — this button
        just asks Neon for the time to prove the connection works.
      </p>

      <button
        onClick={handlePing}
        disabled={status === "checking"}
        className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {status === "checking" ? "Checking…" : "Test connection"}
      </button>

      {result?.ok && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          ✔ Connected. Neon&apos;s clock says:
          <div className="mt-1 font-mono text-xs text-emerald-700">{result.time}</div>
        </div>
      )}

      {result && !result.ok && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          ✕ Failed: {result.error}
        </div>
      )}
    </section>
  );
}

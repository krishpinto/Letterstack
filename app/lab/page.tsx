"use client"; // This page runs in the browser (it has a clickable button + state).

import { useState } from "react";

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

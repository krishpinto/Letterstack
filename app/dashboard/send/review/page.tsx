"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { compileEmailDocument } from "@/lib/email/compiler";
import {
  initialEmailDocument,
  isEmailDocument,
  normalizeDocument,
  STORAGE_KEY,
  type EmailDocument,
} from "@/lib/email/document";

// Review & send — see EXACTLY what goes out (recipients, sender, subject, and a
// real preview of the compiled email) before sending. Send is deliberate here,
// separate from composing.
export default function ReviewPage() {
  const router = useRouter();
  const [doc, setDoc] = useState<EmailDocument | null>(null);
  const [fromName, setFromName] = useState("");
  const [subject, setSubject] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);

  // Load the email composed in the editor (saved to localStorage).
  useEffect(() => {
    let d: EmailDocument = initialEmailDocument;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (isEmailDocument(parsed)) d = normalizeDocument(parsed);
      }
    } catch {
      // ignore
    }
    setDoc(d);
    setFromName(d.fromName || "");
    setSubject(d.subject || "");
  }, []);

  // How many people it'll go to.
  useEffect(() => {
    fetch("/api/lab/recipients")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setCount(data.recipients.length);
      });
  }, []);

  // Compile to the exact HTML that will be sent — same compiler the server uses.
  const html = useMemo(() => (doc ? compileEmailDocument(doc).html : ""), [doc]);

  async function send() {
    setStatus("sending");
    setError(null);
    try {
      const data = await (
        await fetch("/api/campaigns/send-now", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document: doc,
            subject: subject.trim() || undefined,
            fromName: fromName.trim() || undefined,
          }),
        })
      ).json();
      if (!data.ok) {
        setError(data.error);
        setStatus("idle");
        return;
      }
      router.push(`/dashboard/campaigns/${data.id}`);
    } catch {
      setError("Could not reach the server.");
      setStatus("idle");
    }
  }

  if (!doc) return <div className="p-8 text-sm text-zinc-500">Loading…</div>;

  return (
    <div className="p-8 text-zinc-900">
      <Link href="/dashboard/send" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Back to send
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">Review &amp; send</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Exactly what your recipients will get. Check it, then send.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Settings */}
        <div className="space-y-4">
          <Field label="To">
            <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
              {count === null ? "…" : `${count} recipient${count === 1 ? "" : "s"}`}{" "}
              <span className="text-zinc-400">· all non-suppressed</span>
            </div>
          </Field>
          <Field label="From name">
            <input value={fromName} onChange={(e) => setFromName(e.target.value)} className={inputCls} placeholder="Krish Pinto" />
          </Field>
          <Field label="Subject">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} placeholder="Subject line" />
          </Field>

          <button
            onClick={send}
            disabled={status === "sending" || !count}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {status === "sending" ? "Sending…" : `Send to ${count ?? 0}`}
          </button>
          {!count && count !== null && (
            <p className="text-xs text-amber-600">No recipients yet — add some on the Send page.</p>
          )}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">✕ {error}</div>
          )}
          <p className="text-xs text-zinc-400">
            Want changes? Edit in the{" "}
            <Link href="/editor-new" className="underline">editor</Link>, save, then come back.
          </p>
        </div>

        {/* Live preview of the real email */}
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Preview</div>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <iframe title="Email preview" srcDoc={html} className="h-[640px] w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-500">{label}</label>
      {children}
    </div>
  );
}

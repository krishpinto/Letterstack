"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

// Upload → map columns → commit. Parsing + mapping happen in the browser; only
// the final {email,name} rows are POSTed. The server re-validates and dedupes
// (against the list AND suppression) and returns the authoritative summary.

type Summary = {
  received: number;
  imported: number;
  duplicates: number;
  invalid: number;
  suppressed: number;
};

type Parsed = { headers: string[]; rows: string[][]; fileName: string };

function norm(h: string) {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Best-guess column index for email / name from messy client headers.
function guessColumn(headers: string[], kind: "email" | "name"): number {
  const normed = headers.map(norm);
  if (kind === "email") {
    const exact = normed.findIndex((h) => h === "email" || h === "emailaddress" || h === "emailid");
    if (exact >= 0) return exact;
    return normed.findIndex((h) => h.includes("email") || h.includes("mail"));
  }
  const exact = normed.findIndex((h) => h === "name" || h === "fullname");
  if (exact >= 0) return exact;
  return normed.findIndex((h) => h.includes("name"));
}

export function ImportWizard({ onClose, onDone }: { onClose: () => void; onDone: (s: Summary) => void }) {
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [emailCol, setEmailCol] = useState<number>(-1);
  const [nameCol, setNameCol] = useState<number>(-1);
  const [parseError, setParseError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);

  function ingest(headers: string[], rows: string[][], fileName: string) {
    const clean = headers.map((h) => (h ?? "").toString().trim());
    setParsed({ headers: clean, rows, fileName });
    setEmailCol(guessColumn(clean, "email"));
    setNameCol(guessColumn(clean, "name"));
    setParseError(null);
  }

  function onFile(file: File) {
    setParseError(null);
    const isCsv = /\.csv$/i.test(file.name);
    if (isCsv) {
      Papa.parse<string[]>(file, {
        skipEmptyLines: true,
        complete: (res) => {
          const all = res.data as unknown as string[][];
          if (all.length < 2) return setParseError("That file has no data rows.");
          ingest(all[0], all.slice(1), file.name);
        },
        error: () => setParseError("Could not read that CSV."),
      });
      return;
    }
    // XLSX / XLS
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const all = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false, defval: "" });
        if (all.length < 2) return setParseError("That sheet has no data rows.");
        ingest(all[0].map(String), all.slice(1).map((r) => r.map(String)), file.name);
      } catch {
        setParseError("Could not read that spreadsheet.");
      }
    };
    reader.onerror = () => setParseError("Could not read that file.");
    reader.readAsArrayBuffer(file);
  }

  // Build the {email,name} payload from the chosen columns.
  const contacts = useMemo(() => {
    if (!parsed || emailCol < 0) return [];
    return parsed.rows
      .map((r) => ({
        email: (r[emailCol] ?? "").toString().trim(),
        name: nameCol >= 0 ? (r[nameCol] ?? "").toString().trim() : "",
      }))
      .filter((c) => c.email);
  }, [parsed, emailCol, nameCol]);

  async function commit() {
    setCommitting(true);
    try {
      const res = await fetch("/api/recipients/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts }),
      }).then((r) => r.json());
      if (res.ok) setSummary(res.summary);
      else setParseError(res.error || "Import failed");
    } catch {
      setParseError("Could not reach the server.");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-[2px]"
      style={{ animation: "ls-pop .14s ease" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[620px] max-w-[94vw] rounded-2xl bg-white shadow-2xl"
        style={{ animation: "ls-pop .18s cubic-bezier(.2,.8,.3,1)" }}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h2 className="text-[17px] font-semibold">
            {summary ? "Import complete" : parsed ? "Map your columns" : "Import contacts"}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-5">
          {/* ── Step 3: summary ─────────────────────────────────────── */}
          {summary ? (
            <div>
              <div className="grid grid-cols-4 gap-2.5">
                <Stat n={summary.imported} label="Imported" tone="text-emerald-600" />
                <Stat n={summary.duplicates} label="Duplicates" tone="text-zinc-500" />
                <Stat n={summary.invalid} label="Invalid" tone={summary.invalid ? "text-red-600" : "text-zinc-400"} />
                <Stat n={summary.suppressed} label="Suppressed" tone="text-zinc-500" />
              </div>
              <p className="mt-4 text-[13px] text-zinc-500">
                {summary.imported} new contact{summary.imported === 1 ? "" : "s"} added from{" "}
                {summary.received} row{summary.received === 1 ? "" : "s"}. Duplicates and suppressed
                addresses were skipped automatically.
              </p>
              <div className="mt-5 flex justify-end">
                <button onClick={() => onDone(summary)} className={primaryBtn}>
                  Done
                </button>
              </div>
            </div>
          ) : !parsed ? (
            /* ── Step 1: upload ────────────────────────────────────── */
            <div>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50/60 py-12 text-center hover:border-indigo-300 hover:bg-indigo-50/30">
                <span className="text-[15px] font-medium text-zinc-700">Choose a CSV or Excel file</span>
                <span className="text-[13px] text-zinc-400">We&apos;ll map the columns next</span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
              {parseError && <p className="mt-3 text-[13px] text-red-600">{parseError}</p>}
            </div>
          ) : (
            /* ── Step 2: map ───────────────────────────────────────── */
            <div>
              <div className="mb-1 text-[13px] text-zinc-500">
                <span className="font-medium text-zinc-700">{parsed.fileName}</span> ·{" "}
                {parsed.rows.length} row{parsed.rows.length === 1 ? "" : "s"}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <Mapper label="Email column" required value={emailCol} headers={parsed.headers} onChange={setEmailCol} />
                <Mapper label="Name column (optional)" value={nameCol} headers={parsed.headers} onChange={setNameCol} allowNone />
              </div>

              {/* Preview */}
              <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
                <div className="grid grid-cols-2 border-b border-zinc-100 bg-zinc-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  <span>Email</span>
                  <span>Name</span>
                </div>
                {contacts.slice(0, 5).map((c, i) => (
                  <div key={i} className="grid grid-cols-2 border-b border-zinc-50 px-3 py-1.5 text-[13px] last:border-0">
                    <span className="truncate text-zinc-800">{c.email}</span>
                    <span className="truncate text-zinc-500">{c.name || "—"}</span>
                  </div>
                ))}
                {contacts.length === 0 && (
                  <div className="px-3 py-3 text-[13px] text-zinc-400">
                    No email values found in that column — pick a different one.
                  </div>
                )}
              </div>

              <p className="mt-2 text-[12.5px] text-zinc-400">
                {contacts.length} row{contacts.length === 1 ? "" : "s"} with an email will be checked
                for duplicates, invalid syntax, and unsubscribes on import.
              </p>
              {parseError && <p className="mt-2 text-[13px] text-red-600">{parseError}</p>}

              <div className="mt-5 flex items-center justify-between">
                <button onClick={() => setParsed(null)} className={outlineBtn}>
                  Back
                </button>
                <button
                  onClick={commit}
                  disabled={committing || emailCol < 0 || contacts.length === 0}
                  className={primaryBtn}
                >
                  {committing ? "Importing…" : `Import ${contacts.length}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Mapper({
  label,
  value,
  headers,
  onChange,
  required,
  allowNone,
}: {
  label: string;
  value: number;
  headers: string[];
  onChange: (v: number) => void;
  required?: boolean;
  allowNone?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-500">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-[13.5px] text-zinc-800 outline-none focus:border-indigo-300"
      >
        {allowNone && <option value={-1}>— None —</option>}
        {!allowNone && value < 0 && <option value={-1}>Select a column…</option>}
        {headers.map((h, i) => (
          <option key={i} value={i}>
            {h || `Column ${i + 1}`}
          </option>
        ))}
      </select>
    </div>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3 text-center">
      <div className={`text-[22px] font-semibold tabular-nums leading-none ${tone}`}>{n}</div>
      <div className="mt-1 text-[12px] text-zinc-500">{label}</div>
    </div>
  );
}

const primaryBtn =
  "inline-flex h-[38px] items-center gap-[7px] rounded-[9px] border-none bg-indigo-600 px-4 text-[13.5px] font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50";
const outlineBtn =
  "inline-flex h-[38px] items-center gap-[7px] rounded-[9px] border border-zinc-200 bg-white px-3.5 text-[13.5px] font-medium text-zinc-700 hover:bg-zinc-50";

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PREBUILT_TEMPLATES,
  TEMPLATE_CATEGORIES,
  blankDocument,
  documentFromHtml,
  type PrebuiltTemplate,
  type TemplateCategory,
} from "@/lib/email/templates";
import {
  STORAGE_KEY,
  isEmailDocument,
  type EmailBlock,
  type EmailDocument,
} from "@/lib/email/document";

type Tab = "letterstack" | "saved";
type CategoryKey = TemplateCategory | "all";
type Draft = { name: string; updatedAt: string };

export default function TemplatesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("letterstack");
  const [category, setCategory] = useState<CategoryKey>("all");
  const [importOpen, setImportOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  // Read the editor's single working draft (if any) for the "Saved" tab.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (isEmailDocument(parsed)) {
        setDraft({ name: parsed.name || "Untitled Campaign", updatedAt: parsed.updatedAt });
      }
    } catch {
      // ignore corrupt storage
    }
  }, []);

  // Write a document into the editor's storage slot, then open the editor.
  function openDoc(doc: EmailDocument) {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing && existing !== "null") {
        const ok = window.confirm(
          "Opening this will replace your current editor draft. Continue?",
        );
        if (!ok) return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
      // Editor's back button + Save-and-exit return here, not the campaign.
      localStorage.setItem("letterstack-return-to", "/dashboard/templates");
    } catch {
      // if storage is unavailable, still navigate — editor falls back to default
    }
    router.push("/editor-new");
  }

  const filtered = useMemo(
    () =>
      category === "all"
        ? PREBUILT_TEMPLATES
        : PREBUILT_TEMPLATES.filter((t) => t.category === category),
    [category],
  );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Templates</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Start from a LetterStack template, your own HTML, or a blank canvas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Code your own */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              <CodeIcon /> Code your own <ChevronDownIcon />
            </button>
            {menuOpen && (
              <>
                <button
                  className="fixed inset-0 z-10 cursor-default"
                  aria-hidden
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 z-20 mt-1.5 w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setImportOpen(true);
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                  >
                    <CodeIcon /> Import HTML
                  </button>
                  <button
                    disabled
                    className="flex w-full cursor-not-allowed items-center justify-between gap-2.5 px-3.5 py-2.5 text-left text-sm text-zinc-300"
                  >
                    <span className="flex items-center gap-2.5">
                      <ZipIcon /> Import ZIP
                    </span>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-400">
                      Soon
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Create from scratch */}
          <button
            onClick={() => openDoc(blankDocument())}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          >
            <PlusIcon /> Create from scratch
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-6 border-b border-zinc-200">
        <TabButton active={tab === "letterstack"} onClick={() => setTab("letterstack")}>
          LetterStack templates
        </TabButton>
        <TabButton active={tab === "saved"} onClick={() => setTab("saved")}>
          Saved
        </TabButton>
      </div>

      {tab === "letterstack" ? (
        <>
          {/* Category pills */}
          <div className="mt-5 flex flex-wrap gap-1.5">
            {TEMPLATE_CATEGORIES.map((c) => {
              const active = category === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className={`h-8 rounded-full border px-3.5 text-[13px] font-medium transition-colors ${
                    active
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          {/* Grid */}
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((t) => (
              <TemplateCard key={t.id} template={t} onOpen={() => openDoc(t.build())} />
            ))}
          </div>
        </>
      ) : (
        <SavedTab draft={draft} onContinue={() => router.push("/editor-new")} />
      )}

      {importOpen && (
        <ImportHtmlModal
          onClose={() => setImportOpen(false)}
          onImport={(html) => openDoc(documentFromHtml(html))}
        />
      )}
    </div>
  );
}

// ── Template card + schematic preview ────────────────────────────────────────

function TemplateCard({ template, onOpen }: { template: PrebuiltTemplate; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white text-left transition-shadow hover:shadow-md"
    >
      <TemplateThumb template={template} />
      <div className="flex flex-1 flex-col p-3.5">
        <div className="text-sm font-semibold text-zinc-800">{template.title}</div>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">
          {template.description}
        </p>
        <div className="mt-3 flex items-center gap-2 pt-1">
          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
            <MailIcon /> Email
          </span>
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-600">
            Free
          </span>
        </div>
      </div>
    </button>
  );
}

function TemplateThumb({ template }: { template: PrebuiltTemplate }) {
  const doc = useMemo(() => template.build(), [template]);
  return (
    <div
      className="flex h-44 items-start justify-center overflow-hidden border-b border-zinc-100 p-4"
      style={{ backgroundColor: doc.settings.backgroundColor }}
    >
      <div className="w-full max-w-[180px] space-y-2 rounded-md bg-white p-3 shadow-sm">
        {doc.blocks.slice(0, 6).map((b) => (
          <Silhouette key={b.id} block={b} accent={template.accent} />
        ))}
      </div>
    </div>
  );
}

function Silhouette({ block, accent }: { block: EmailBlock; accent: string }) {
  switch (block.type) {
    case "logo":
      return <div className="h-2 w-12 rounded bg-zinc-300" />;
    case "heading":
      return <div className="h-2.5 w-2/3 rounded bg-zinc-400" />;
    case "text":
      return (
        <div className="space-y-1">
          <div className="h-1.5 w-1/3 rounded bg-zinc-300" />
          <div className="h-2 w-3/4 rounded bg-zinc-400" />
          <div className="h-1.5 w-full rounded bg-zinc-200" />
        </div>
      );
    case "paragraph":
      return (
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded bg-zinc-200" />
          <div className="h-1.5 w-5/6 rounded bg-zinc-200" />
        </div>
      );
    case "image":
      return <div className="h-12 w-full rounded bg-zinc-200" />;
    case "articleCard":
      return (
        <div className="flex gap-2">
          <div className="h-8 w-10 shrink-0 rounded bg-zinc-200" />
          <div className="flex-1 space-y-1 pt-0.5">
            <div className="h-1.5 w-3/4 rounded bg-zinc-400" />
            <div className="h-1.5 w-full rounded bg-zinc-200" />
            <div className="h-1.5 w-2/3 rounded bg-zinc-200" />
          </div>
        </div>
      );
    case "button":
      return <div className="h-3 w-20 rounded" style={{ backgroundColor: accent }} />;
    case "divider":
      return <div className="h-px w-full bg-zinc-200" />;
    case "footer":
      return (
        <div className="space-y-1 pt-1">
          <div className="h-1.5 w-1/2 rounded bg-zinc-200" />
          <div className="h-1.5 w-1/3 rounded bg-zinc-200" />
        </div>
      );
    default:
      return <div className="h-2 w-1/2 rounded bg-zinc-200" />;
  }
}

// ── Saved tab ────────────────────────────────────────────────────────────────

function SavedTab({ draft, onContinue }: { draft: Draft | null; onContinue: () => void }) {
  return (
    <div className="mt-6">
      {draft && (
        <button
          onClick={onContinue}
          className="flex w-full max-w-md items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-left transition-shadow hover:shadow-md"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
            <MailIcon />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-zinc-800">{draft.name}</div>
            <div className="text-xs text-zinc-400">
              Last edited {new Date(draft.updatedAt).toLocaleString()}
            </div>
          </div>
          <span className="text-xs font-medium text-indigo-600">Continue →</span>
        </button>
      )}

      <div className="mt-6 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-10 text-center">
        <p className="text-sm font-medium text-zinc-600">Saved templates are coming</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-zinc-400">
          Soon you'll be able to save any campaign as a reusable template and find it here.
          {draft ? " For now, your current draft is shown above." : ""}
        </p>
      </div>
    </div>
  );
}

// ── Import HTML modal ────────────────────────────────────────────────────────

function ImportHtmlModal({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (html: string) => void;
}) {
  const [html, setHtml] = useState("");

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then(setHtml);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-zinc-900/40" aria-hidden onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-800">Import HTML</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <XIcon />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <p className="text-sm text-zinc-500">
            Paste your email HTML or upload a <code className="text-zinc-700">.html</code> file. It
            opens in the editor as a single custom-HTML block you can keep editing.
          </p>
          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            placeholder="<table>…</table>"
            spellCheck={false}
            className="h-44 w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-800 outline-none focus:border-zinc-300"
          />
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-indigo-600 hover:underline">
            <UploadIcon /> Upload .html file
            <input type="file" accept=".html,text/html" className="hidden" onChange={onFile} />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4">
          <button
            onClick={onClose}
            className="h-9 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onImport(html)}
            disabled={!html.trim()}
            className="h-9 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Open in editor
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bits ─────────────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors ${
        active
          ? "border-zinc-900 text-zinc-900"
          : "border-transparent text-zinc-400 hover:text-zinc-600"
      }`}
    >
      {children}
    </button>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
function CodeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
    </svg>
  );
}
function ZipIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}
function UploadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
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

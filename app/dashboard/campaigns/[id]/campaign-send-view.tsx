"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { STORAGE_KEY, type EmailDocument } from "@/lib/email/document";

export type DraftCampaign = {
  id: string;
  name: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  status: string;
  htmlSnapshot: string;
  document: EmailDocument | null;
};

type SectionKey = "to" | "from" | "subject" | "sendtime";

// The structured, Mailchimp-style send page for a DRAFT campaign. Each row is an
// expandable section; To/From/Subject persist to the campaign via PATCH.
export function CampaignSendView({
  campaign: initial,
  onSent,
}: {
  campaign: DraftCampaign;
  onSent: () => void;
}) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<DraftCampaign>(initial);
  const [open, setOpen] = useState<SectionKey | null>(null);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable form fields, seeded from the campaign and re-synced after saves.
  const [fromName, setFromName] = useState(initial.fromName);
  const [subject, setSubject] = useState(initial.subject);
  const [previewText, setPreviewText] = useState(initial.document?.settings.previewText ?? "");
  const [savingSection, setSavingSection] = useState<SectionKey | null>(null);

  // Branded sending identity (per-account subdomain slug).
  const [slug, setSlug] = useState("");
  const [baseDomain, setBaseDomain] = useState("letterstack.site");
  const [slugError, setSlugError] = useState<string | null>(null);

  useEffect(() => {
    setFromName(campaign.fromName);
    setSubject(campaign.subject);
    setPreviewText(campaign.document?.settings.previewText ?? "");
  }, [campaign]);

  useEffect(() => {
    fetch("/api/lab/recipients")
      .then((r) => r.json())
      .then((d) => setRecipientCount(d.ok ? d.recipients.length : 0))
      .catch(() => setRecipientCount(0));
  }, []);

  // Load the account's branded sending subdomain.
  useEffect(() => {
    fetch("/api/account/sending")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setSlug(d.slug ?? "");
          setBaseDomain(d.baseDomain);
        }
      })
      .catch(() => {});
  }, []);

  const hasDoc = Boolean(campaign.document);
  const ready = {
    to: (recipientCount ?? 0) > 0,
    from: Boolean(campaign.fromName.trim() && campaign.fromEmail.trim()),
    subject: Boolean(campaign.subject.trim()),
    sendtime: true,
    content: true,
  };
  const canSend = ready.to && ready.from && ready.subject;
  const doneCount = Object.values(ready).filter(Boolean).length;

  function toggle(key: SectionKey) {
    setOpen((cur) => (cur === key ? null : key));
  }

  // Persist edited fields by mutating the campaign's document and PATCHing it
  // (the server recompiles the snapshot and updates the campaign columns).
  async function saveSection(key: SectionKey, mutate: (d: EmailDocument) => void) {
    if (!campaign.document) return;
    setSavingSection(key);
    setError(null);
    try {
      const nextDoc: EmailDocument = JSON.parse(JSON.stringify(campaign.document));
      mutate(nextDoc);
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: nextDoc }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Could not save");
        return;
      }
      setCampaign(data.campaign);
      setOpen(null);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSavingSection(null);
    }
  }

  // Save the From section: persist the account slug (validated server-side),
  // then apply the resulting branded address to this campaign.
  async function saveFrom() {
    if (!campaign.document) return;
    setSavingSection("from");
    setSlugError(null);
    setError(null);
    try {
      const res = await fetch("/api/account/sending", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (!data.ok) {
        setSlugError(data.error || "Invalid subdomain");
        setSavingSection(null);
        return;
      }
      await saveSection("from", (d) => {
        d.fromName = fromName.trim();
        d.fromEmail = data.address;
      });
    } catch {
      setError("Could not reach the server.");
      setSavingSection(null);
    }
  }

  // "Edit design": load this campaign's design into the editor's storage slot.
  // NOTE: the editor saving back (PATCH /api/campaigns/<id>) is the wired seam.
  function editDesign() {
    if (campaign.document) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(campaign.document));
        localStorage.setItem("letterstack-editing-campaign", campaign.id);
        // Where the editor's back button + Save-and-exit should return to.
        localStorage.setItem("letterstack-return-to", `/dashboard/campaigns/${campaign.id}`);
      } catch {
        // ignore
      }
    }
    router.push("/editor-new");
  }

  async function send() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/send`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Could not send");
        setSending(false);
        return;
      }
      onSent();
    } catch {
      setError("Could not reach the server.");
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-dvh flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-4 border-b border-zinc-200 bg-white px-6 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/dashboard/campaigns" className="text-zinc-400 hover:text-zinc-700" title="Back">
            <BackIcon />
          </Link>
          <h1 className="truncate text-base font-semibold text-zinc-900">{campaign.name}</h1>
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">Draft</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/campaigns"
            className="h-9 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium leading-9 text-zinc-600 hover:bg-zinc-50"
          >
            Finish later
          </Link>
          <button
            onClick={send}
            disabled={sending || !canSend}
            className="h-9 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </header>

      {error && (
        <div className="border-b border-red-200 bg-red-50 px-6 py-2.5 text-sm text-red-700">{error}</div>
      )}

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_1fr]">
        {/* Left: checklist */}
        <div className="overflow-auto p-6">
          <div className="mx-auto max-w-2xl">
            {/* Completion bar */}
            <div className="mb-4">
              <div className="mb-1.5 text-xs font-medium text-zinc-500">{doneCount}/5 items ready</div>
              <div className="flex gap-1">
                {Object.values(ready).map((ok, i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full ${ok ? "bg-emerald-500" : "bg-zinc-200"}`} />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {/* To */}
              <Section
                done={ready.to}
                label="To"
                open={open === "to"}
                onToggle={() => toggle("to")}
                summary={
                  <>
                    <span className="font-medium text-zinc-800">
                      {recipientCount === null ? "…" : `${recipientCount} recipient${recipientCount === 1 ? "" : "s"}`}
                    </span>
                    <span className="text-zinc-500"> · All contacts</span>
                  </>
                }
              >
                <p className="text-sm text-zinc-500">Who are you sending this to?</p>
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Send to</label>
                  <div className="flex h-10 items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700">
                    All contacts ({recipientCount ?? 0})
                  </div>
                </div>
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Do not send to</label>
                  <div className="flex h-10 items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-500">
                    Your do-not-mail list is always excluded
                  </div>
                </div>
                <ComingSoon>Segments &amp; tags for finer targeting</ComingSoon>
              </Section>

              {/* From */}
              <Section
                done={ready.from}
                label="From"
                open={open === "from"}
                onToggle={() => toggle("from")}
                summary={
                  <>
                    <span className="font-medium text-zinc-800">{campaign.fromName || "No name"}</span>
                    <span className="text-zinc-500"> · {campaign.fromEmail || "no email"}</span>
                  </>
                }
              >
                <p className="text-sm text-zinc-500">Who is sending this email?</p>
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-zinc-500">From name</label>
                  <input value={fromName} onChange={(e) => setFromName(e.target.value)} className={inputCls} placeholder="CIBA" />
                </div>
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Sending address</label>
                  <div className="flex items-stretch overflow-hidden rounded-lg border border-zinc-200 focus-within:border-zinc-300">
                    <span className="flex items-center bg-zinc-50 px-3 text-sm text-zinc-500">newsletter@</span>
                    <input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      className="h-10 min-w-0 flex-1 px-1.5 text-sm text-zinc-800 outline-none"
                      placeholder="ciba"
                    />
                    <span className="flex items-center bg-zinc-50 px-3 text-sm text-zinc-500">.{baseDomain}</span>
                  </div>
                  {slugError && <p className="mt-1.5 text-xs text-red-600">{slugError}</p>}
                  <p className="mt-1.5 text-xs text-zinc-400">
                    A branded subdomain of {baseDomain} — works immediately, no domain verification
                    needed. Sending from your own domain is a future upgrade.
                  </p>
                </div>
                <SaveCancel
                  saving={savingSection === "from"}
                  disabled={!hasDoc || !fromName.trim() || !slug.trim()}
                  onSave={saveFrom}
                  onCancel={() => setOpen(null)}
                />
              </Section>

              {/* Subject */}
              <Section
                done={ready.subject}
                label="Subject"
                open={open === "subject"}
                onToggle={() => toggle("subject")}
                summary={
                  <>
                    <span className="font-medium text-zinc-800">{campaign.subject || "No subject yet"}</span>
                    {previewText && <div className="text-zinc-500">Preview text: {previewText}</div>}
                  </>
                }
              >
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Subject line</label>
                  <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} placeholder="Your monthly update" />
                </div>
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-zinc-500">Preview text</label>
                  <input value={previewText} onChange={(e) => setPreviewText(e.target.value)} className={inputCls} placeholder="The short line shown after the subject" />
                </div>
                <SaveCancel
                  saving={savingSection === "subject"}
                  disabled={!hasDoc || !subject.trim()}
                  onSave={() =>
                    saveSection("subject", (d) => {
                      d.subject = subject.trim();
                      d.settings.previewText = previewText.trim();
                    })
                  }
                  onCancel={() => setOpen(null)}
                />
              </Section>

              {/* Send time */}
              <Section
                done
                label="Send time"
                open={open === "sendtime"}
                onToggle={() => toggle("sendtime")}
                summary={<span className="font-medium text-zinc-800">Send now</span>}
              >
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-900 bg-zinc-50/60 p-3">
                  <input type="radio" checked readOnly className="accent-zinc-900" />
                  <span className="text-sm font-medium text-zinc-800">Send now</span>
                </label>
                <label className="mt-2 flex items-center gap-3 rounded-lg border border-zinc-200 p-3 opacity-60">
                  <input type="radio" disabled className="accent-zinc-400" />
                  <span className="flex-1 text-sm text-zinc-500">Schedule for later</span>
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-400">
                    Coming soon
                  </span>
                </label>
              </Section>

              {/* Content (non-collapsible) */}
              <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4">
                <CheckDot done />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-zinc-900">Content</div>
                  <p className="mt-0.5 text-sm text-zinc-500">
                    Designed in the editor. Use Edit design to change the email being sent.
                  </p>
                </div>
                <button
                  onClick={editDesign}
                  className="h-8 shrink-0 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Edit design
                </button>
              </div>

              {!canSend && (
                <p className="px-1 pt-1 text-xs text-amber-600">
                  {!ready.to
                    ? "Add recipients under Audience before sending."
                    : !ready.subject
                      ? "Add a subject before sending."
                      : !ready.from
                        ? "Set a from name and email before sending."
                        : ""}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right: live preview */}
        <div className="hidden overflow-auto border-l border-zinc-200 bg-zinc-100 p-6 lg:block">
          <div className="mx-auto max-w-md">
            <div className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-zinc-400">Preview</div>
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
              <iframe title="Email preview" srcDoc={campaign.htmlSnapshot} className="h-[640px] w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-800 outline-none focus:border-zinc-300";

function Section({
  done,
  label,
  open,
  onToggle,
  summary,
  children,
}: {
  done: boolean;
  label: string;
  open: boolean;
  onToggle: () => void;
  summary: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <button onClick={onToggle} className="flex w-full items-start gap-3 p-4 text-left">
        <CheckDot done={done} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-zinc-900">{label}</span>
            <span className={`text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}>
              <ChevronIcon />
            </span>
          </div>
          {!open && <div className="mt-0.5 text-sm">{summary}</div>}
        </div>
      </button>
      {open && <div className="border-t border-zinc-100 p-4">{children}</div>}
    </div>
  );
}

function SaveCancel({
  saving,
  disabled,
  onSave,
  onCancel,
}: {
  saving: boolean;
  disabled?: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-4 flex items-center gap-2">
      <button
        onClick={onSave}
        disabled={saving || disabled}
        className="h-9 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      <button
        onClick={onCancel}
        className="h-9 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
      >
        Cancel
      </button>
    </div>
  );
}

function ComingSoon({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 px-3 py-2 text-xs text-zinc-400">
      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-400">Soon</span>
      {children}
    </div>
  );
}

function CheckDot({ done }: { done?: boolean }) {
  return (
    <div
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
        done ? "bg-emerald-500 text-white" : "border border-zinc-300 text-transparent"
      }`}
    >
      ✓
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

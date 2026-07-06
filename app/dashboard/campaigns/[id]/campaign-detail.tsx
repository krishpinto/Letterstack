"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  BarChart2Icon,
  CalendarClockIcon,
  CheckIcon,
  Edit3Icon,
  PlusIcon,
  ReplaceIcon,
  RotateCcwIcon,
  SendIcon,
  Trash2Icon,
  TriangleAlertIcon,
  UploadIcon,
  UsersRoundIcon,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STORAGE_KEY, type EmailDocument } from "@/lib/email/document";
import { PREBUILT_TEMPLATES, blankDocument } from "@/lib/email/templates";
import { cn } from "@/lib/utils";
import { ImportWizard } from "../../contacts/import-wizard";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CampaignData = {
  id: string;
  name: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  status: string;
  scheduledAt?: string | null;
  htmlSnapshot: string;
  document: EmailDocument | null;
};

// datetime-local inputs want local wall-clock time, not the UTC ISO string.
function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatScheduleTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

type SectionKey = "to" | "from" | "subject" | "sendtime";

type CampaignRecipient = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  sentAt: string | null;
  error: string | null;
};

type ProgressState = {
  total: number;
  sent: number;
  failed: number;
  pending: number;
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function CampaignDetail({
  campaign: initial,
  onRefresh,
}: {
  campaign: CampaignData;
  onRefresh: () => void;
}) {
  const router = useRouter();
  const isDraft = initial.status === "draft";
  const isScheduled = initial.status === "scheduled";
  // Scheduled campaigns stay editable — the snapshot is read at fire time.
  const isEditable = isDraft || isScheduled;
  const initialRef = useRef(initial);

  const [campaign, setCampaign] = useState<CampaignData>(initial);
  const [open, setOpen] = useState<SectionKey | null>(null);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Send-time state
  const [sendMode, setSendMode] = useState<"now" | "schedule">(
    initial.status === "scheduled" ? "schedule" : "now",
  );
  const [scheduleAt, setScheduleAt] = useState(() =>
    initial.scheduledAt ? toLocalInputValue(new Date(initial.scheduledAt)) : "",
  );
  const [scheduling, setScheduling] = useState(false);
  const [cancelingSchedule, setCancelingSchedule] = useState(false);

  // Editable field state
  const [fromName, setFromName] = useState(initial.fromName);
  const [subject, setSubject] = useState(initial.subject);
  const [previewText, setPreviewText] = useState(
    initial.document?.settings.previewText ?? "",
  );
  const [savingSection, setSavingSection] = useState<SectionKey | null>(null);
  const [sharedFromEmail, setSharedFromEmail] = useState("");
  const [senderDomains, setSenderDomains] = useState<
    { domain: string; readyToSend: boolean }[]
  >([]);
  // "shared" or one of the connected domain names.
  const [senderSource, setSenderSource] = useState("shared");
  const [customLocal, setCustomLocal] = useState("");
  const [reusing, setReusing] = useState(false);

  // Audience state
  const [audienceEmail, setAudienceEmail] = useState("");
  const [audienceName, setAudienceName] = useState("");
  const [audienceError, setAudienceError] = useState<string | null>(null);
  const [audienceSaving, setAudienceSaving] = useState(false);
  const [audienceImporting, setAudienceImporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Send progress (non-draft only)
  const [progress, setProgress] = useState<ProgressState | null>(null);

  // Switch-template dialog (draft only)
  const [switchOpen, setSwitchOpen] = useState(false);
  const [switchTemplateId, setSwitchTemplateId] = useState("blank");
  const [switching, setSwitching] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<
    { id: string; name: string }[]
  >([]);

  useEffect(() => {
    if (!switchOpen) return;
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setSavedTemplates(
            (data.templates ?? []).map((t: { id: string; name: string }) => ({
              id: t.id,
              name: t.name,
            })),
          );
        }
      })
      .catch(() => {});
  }, [switchOpen]);

  // Sync if parent re-fetches and passes a new campaign prop
  useEffect(() => {
    setCampaign(initial);
    setFromName(initial.fromName);
    setSubject(initial.subject);
    setPreviewText(initial.document?.settings.previewText ?? "");
    setSendMode(initial.status === "scheduled" ? "schedule" : "now");
    setScheduleAt(
      initial.scheduledAt ? toLocalInputValue(new Date(initial.scheduledAt)) : "",
    );
  }, [initial]);

  // Load recipients
  const loadAudience = useCallback(async () => {
    try {
      const r = await fetch(`/api/campaigns/${campaign.id}/recipients`);
      const data = await r.json();
      if (data.ok) {
        setRecipients(data.recipients);
        setRecipientCount(data.recipients.length);
        return;
      }
    } catch {
      // swallow
    }
    setRecipients([]);
    setRecipientCount(0);
  }, [campaign.id]);

  useEffect(() => {
    loadAudience();
  }, [loadAudience]);

  // Load the sender addresses this org can use (shared + verified custom
  // domains), and reflect the campaign's current From address in the picker.
  useEffect(() => {
    fetch("/api/domains")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) return;
        setSharedFromEmail(data.sharedFromEmail ?? "");
        const list: { domain: string; readyToSend: boolean }[] =
          data.domains ?? [];
        setSenderDomains(list);

        const current = initialRef.current.fromEmail;
        const at = current.lastIndexOf("@");
        const currentDomain = at > 0 ? current.slice(at + 1) : "";
        const match = list.find((entry) => entry.domain === currentDomain);
        if (match) {
          setSenderSource(match.domain);
          setCustomLocal(current.slice(0, at));
        } else {
          setSenderSource("shared");
        }
      })
      .catch(() => {});
  }, []);

  // Poll send progress once the campaign is actually sending
  useEffect(() => {
    if (isEditable) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const r = await fetch(`/api/campaigns/${campaign.id}/progress`);
        const data = await r.json();
        if (!alive) return;
        if (data.ok) {
          setCampaign((c) => ({ ...(c ?? initialRef.current), ...data.campaign }));
          setProgress(data.progress);
          if (data.progress.pending > 0) {
            timer = setTimeout(poll, 1500);
          }
        }
      } catch {
        // ignore polling errors
      }
    }

    poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [campaign.id, isEditable]);

  // ─── Derived state ──────────────────────────────────────────────────────────

  const hasDoc = Boolean(campaign.document);
  const htmlBytes = useMemo(
    () => new TextEncoder().encode(campaign.htmlSnapshot).length,
    [campaign.htmlSnapshot],
  );
  const gmailClipRisk = htmlBytes > 102_000;
  const hasUnsubscribe = campaign.htmlSnapshot.includes("{{unsubscribe_url}}");

  const ready = {
    to: (recipientCount ?? 0) > 0,
    from: Boolean(campaign.fromName.trim() && campaign.fromEmail.trim()),
    subject: Boolean(campaign.subject.trim()),
    sendtime: sendMode === "now" || Boolean(scheduleAt),
    content: true,
    unsubscribe: hasUnsubscribe,
  };
  const canSend = ready.to && ready.from && ready.subject && ready.unsubscribe;
  const doneCount = Object.values(ready).filter(Boolean).length;
  const totalItems = Object.keys(ready).length;

  // Progress derived values
  const progressTotal = progress?.total ?? 0;
  const progressSent = progress?.sent ?? 0;
  const progressFailed = progress?.failed ?? 0;
  const progressDone = progressSent + progressFailed;
  const progressPct =
    progressTotal > 0 ? Math.round((progressDone / progressTotal) * 100) : 0;
  const isFinished =
    !isEditable && progressTotal > 0 && (progress?.pending ?? 0) === 0;
  const deliveryRate =
    progressTotal > 0
      ? Math.round((progressSent / progressTotal) * 100)
      : 0;

  // ─── Handlers ───────────────────────────────────────────────────────────────

  async function saveSection(
    key: SectionKey,
    mutate: (doc: EmailDocument) => void,
  ) {
    if (!campaign.document) return;
    setSavingSection(key);
    setError(null);
    try {
      const nextDoc: EmailDocument = JSON.parse(
        JSON.stringify(campaign.document),
      );
      mutate(nextDoc);
      const r = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: nextDoc }),
      });
      const data = await r.json();
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

  async function saveFrom() {
    if (!campaign.document) return;
    const fromEmail =
      senderSource !== "shared"
        ? `${customLocal.trim() || "hello"}@${senderSource}`
        : sharedFromEmail;
    await saveSection("from", (doc) => {
      doc.fromName = fromName.trim();
      doc.fromEmail = fromEmail;
    });
  }

  async function switchTemplate() {
    setSwitching(true);
    setError(null);
    try {
      // Build the replacement design from the chosen starting point.
      let doc: EmailDocument | null = null;
      const prebuilt = PREBUILT_TEMPLATES.find((t) => t.id === switchTemplateId);
      if (prebuilt) {
        doc = prebuilt.build();
      } else if (switchTemplateId === "blank") {
        doc = blankDocument();
      } else {
        const r = await fetch(`/api/templates/${switchTemplateId}`);
        const data = await r.json();
        if (data.ok && data.template?.document) {
          doc = JSON.parse(JSON.stringify(data.template.document));
        }
      }
      if (!doc) {
        setError("Could not load that template.");
        setSwitching(false);
        return;
      }

      // The design changes; the campaign's identity fields stay.
      doc.name = campaign.name;
      if (campaign.subject) doc.subject = campaign.subject;
      if (campaign.fromName) doc.fromName = campaign.fromName;
      doc.fromEmail = campaign.fromEmail;

      const r = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: doc }),
      });
      const data = await r.json();
      if (!data.ok) {
        setError(data.error || "Could not switch the template.");
        setSwitching(false);
        return;
      }
      setCampaign(data.campaign);
      setSwitchOpen(false);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSwitching(false);
    }
  }

  async function reuseCampaign() {
    setReusing(true);
    setError(null);
    try {
      const r = await fetch(`/api/campaigns/${campaign.id}/reuse`, {
        method: "POST",
      });
      const data = await r.json();
      if (!data.ok) {
        setError(data.error || "Could not reuse this campaign.");
        setReusing(false);
        return;
      }
      router.push(`/dashboard/campaigns/${data.id}`);
    } catch {
      setError("Could not reach the server.");
      setReusing(false);
    }
  }

  async function addAudienceRecipient() {
    if (!audienceEmail.trim()) return;
    setAudienceSaving(true);
    setAudienceError(null);
    try {
      const r = await fetch(`/api/campaigns/${campaign.id}/recipients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: audienceEmail,
          name: audienceName || undefined,
        }),
      });
      const data = await r.json();
      if (!data.ok) {
        setAudienceError(data.error || "Could not add recipient");
        return;
      }
      setAudienceEmail("");
      setAudienceName("");
      await loadAudience();
    } catch {
      setAudienceError("Could not reach the server.");
    } finally {
      setAudienceSaving(false);
    }
  }

  async function addOrganizationAudience() {
    setAudienceImporting(true);
    setAudienceError(null);
    try {
      const r = await fetch(
        `/api/campaigns/${campaign.id}/recipients/from-audience`,
        { method: "POST" },
      );
      const data = await r.json();
      if (!data.ok) {
        setAudienceError(
          data.error || "Could not add organization audience",
        );
        return;
      }
      if (data.summary.imported === 0) {
        setAudienceError(
          data.summary.selected === 0
            ? "This organization has no audience contacts yet."
            : "Every eligible organization contact is already on this campaign.",
        );
      }
      await loadAudience();
    } catch {
      setAudienceError("Could not reach the server.");
    } finally {
      setAudienceImporting(false);
    }
  }

  async function removeAudienceRecipient(id: string) {
    const data = await fetch(
      `/api/campaigns/${campaign.id}/recipients?recipientId=${id}`,
      { method: "DELETE" },
    ).then((r) => r.json());
    if (data.ok) await loadAudience();
    else setAudienceError(data.error || "Could not remove recipient");
  }

  function editDesign() {
    if (campaign.document) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(campaign.document));
        localStorage.setItem("letterstack-editing-campaign", campaign.id);
        localStorage.setItem(
          "letterstack-return-to",
          `/dashboard/campaigns/${campaign.id}`,
        );
      } catch {
        // ignore unavailable storage
      }
    }
    router.push(`/editor/${campaign.id}`);
  }

  async function send() {
    setSending(true);
    setError(null);
    try {
      const r = await fetch(`/api/campaigns/${campaign.id}/send`, {
        method: "POST",
      });
      const data = await r.json();
      if (!data.ok) {
        setError(data.error || "Could not send");
        setSending(false);
        return;
      }
      onRefresh();
    } catch {
      setError("Could not reach the server.");
      setSending(false);
    }
  }

  async function scheduleCampaign() {
    if (!scheduleAt) {
      setError("Pick a date and time first.");
      return;
    }
    setScheduling(true);
    setError(null);
    try {
      const r = await fetch(`/api/campaigns/${campaign.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: new Date(scheduleAt).toISOString(),
        }),
      });
      const data = await r.json();
      if (!data.ok) {
        setError(data.error || "Could not schedule");
        return;
      }
      setOpen(null);
      onRefresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setScheduling(false);
    }
  }

  async function cancelSchedule() {
    setCancelingSchedule(true);
    setError(null);
    try {
      const r = await fetch(`/api/campaigns/${campaign.id}/schedule`, {
        method: "DELETE",
      });
      const data = await r.json();
      if (!data.ok) {
        setError(data.error || "Could not cancel the schedule");
        return;
      }
      onRefresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setCancelingSchedule(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header ── */}
      <header className="flex items-center justify-between gap-4 border p-3 rounded-lg border-border">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="outline" size="icon-sm" asChild>
            <Link href="/dashboard/campaigns">
              <ArrowLeftIcon data-icon="inline-start" />
            </Link>
          </Button>
          <h1 className="truncate text-base font-semibold">{campaign.name}</h1>
          <CampaignStatusBadge
            status={campaign.status}
            isFinished={isFinished}
          />
        </div>
        <div className="flex items-center gap-2">
          {!isEditable && (
            <>
              <Button variant="outline" asChild>
                <Link href={`/dashboard/campaigns/analytics/${campaign.id}`}>
                  <BarChart2Icon data-icon="inline-start" />
                  View analytics
                </Link>
              </Button>
              <Button onClick={reuseCampaign} disabled={reusing}>
                {reusing ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <RotateCcwIcon data-icon="inline-start" />
                )}
                {reusing ? "Creating draft…" : "Reuse campaign"}
              </Button>
            </>
          )}
          {isScheduled && (
            <>
              <Button
                variant="outline"
                onClick={cancelSchedule}
                disabled={cancelingSchedule}
              >
                {cancelingSchedule && <Spinner data-icon="inline-start" />}
                Cancel schedule
              </Button>
              <Button onClick={send} disabled={sending || !canSend}>
                {sending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <SendIcon data-icon="inline-start" />
                )}
                {sending ? "Sending…" : "Send now"}
              </Button>
            </>
          )}
          {isDraft && (
            <>
              <Button variant="outline" asChild>
                <Link href="/dashboard/campaigns">Finish later</Link>
              </Button>
              {sendMode === "schedule" ? (
                <Button
                  onClick={scheduleCampaign}
                  disabled={scheduling || !canSend || !scheduleAt}
                >
                  {scheduling ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <CalendarClockIcon data-icon="inline-start" />
                  )}
                  {scheduling ? "Scheduling…" : "Schedule"}
                </Button>
              ) : (
                <Button onClick={send} disabled={sending || !canSend}>
                  {sending ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <SendIcon data-icon="inline-start" />
                  )}
                  {sending ? "Sending…" : "Send"}
                </Button>
              )}
            </>
          )}
        </div>
      </header>
      {/* ── Alerts ── */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {gmailClipRisk && (
        <Alert>
          <TriangleAlertIcon data-icon="inline-start" />
          <AlertDescription>
            This email is {Math.round(htmlBytes / 1024)}KB — over Gmail&apos;s
            ~102KB clipping limit. Content near the end (including the
            unsubscribe link) may be hidden.
          </AlertDescription>
        </Alert>
      )}

      {/* ── Scheduled banner ── */}
      {isScheduled && campaign.scheduledAt && (
        <Alert>
          <CalendarClockIcon data-icon="inline-start" />
          <AlertDescription>
            This campaign is scheduled to send on{" "}
            <span className="font-medium text-foreground">
              {formatScheduleTime(campaign.scheduledAt)}
            </span>
            . You can still edit it, change the time, or cancel until then.
          </AlertDescription>
        </Alert>
      )}

      {/* ── Send progress bar (once sending) ── */}
      {!isEditable && progress && (
        <Card size="sm">
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">
                {isFinished
                  ? `${deliveryRate}% delivered`
                  : `Sending… ${progressDone}/${progressTotal}`}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {isFinished
                  ? `${progressSent}/${progressTotal} delivered`
                  : `${progressPct}%`}
              </span>
            </div>
            <Progress value={isFinished ? deliveryRate : progressPct} />
          </CardContent>
        </Card>
      )}

      {/* ── Main grid ── */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(520px,1.1fr)]">

        {/* ── LEFT: Send checklist ── */}
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="py-0 gap-0">
            <CardHeader className="py-4 px-4 bg-card">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base font-semibold">Send checklist</CardTitle>
                <div className="flex items-center gap-3">
                  {/* Segmented progress bar as vertical pill indicators */}
                  <div className="flex gap-[3px] items-center">
                    {Array.from({ length: 18 }).map((_, i) => {
                      const activeSegments = Math.round((doneCount / totalItems) * 18);
                      return (
                        <div
                          key={i}
                          className={cn(
                            "h-3.5 w-[3px] rounded-full transition-colors duration-300",
                            i < activeSegments ? "bg-emerald-500" : "bg-zinc-800"
                          )}
                        />
                      );
                    })}
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-foreground/90">
                    {doneCount}/{totalItems}
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col p-0 bg-card">
              {isEditable ? (
                // ── DRAFT / SCHEDULED: interactive accordion ──
                <>
                  <Accordion
                    type="single"
                    collapsible
                    value={open ?? ""}
                    onValueChange={(v) =>
                      setOpen(v ? (v as SectionKey) : null)
                    }
                    className="flex flex-col divide-y divide-border"
                  >
                    {/* To */}
                    <AccordionItem
                      value="to"
                      className={cn(
                        "border-0 transition-colors duration-200",
                        open === "to" ? "bg-muted/40" : "hover:bg-muted/10"
                      )}
                    >
                      <AccordionTrigger className="px-4 py-3.5 hover:no-underline">
                        <span className="flex min-w-0 items-start gap-3">
                          <StepCircle done={ready.to} num={1} active={open === "to"} />
                          <span className="min-w-0 text-left">
                            <span className="block text-sm font-semibold">
                              To
                            </span>
                            <span className="mt-0.5 block text-xs">
                              <span className="font-semibold text-foreground">
                                {recipientCount === null
                                  ? "…"
                                  : `${recipientCount} recipient${recipientCount === 1 ? "" : "s"}`}
                              </span>
                              <span className="text-muted-foreground">
                                {" "}
                                — Campaign audience
                              </span>
                            </span>
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 pt-1">
                        <FieldGroup className="gap-4">
                          <Field>
                            <FieldLabel>Add recipient</FieldLabel>
                            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_auto]">
                              <Input
                                value={audienceEmail}
                                onChange={(e) =>
                                  setAudienceEmail(e.target.value)
                                }
                                placeholder="email@example.com"
                                onKeyDown={(e) => {
                                  if (
                                    e.key === "Enter" &&
                                    audienceEmail.trim()
                                  )
                                    addAudienceRecipient();
                                }}
                              />
                              <Input
                                value={audienceName}
                                onChange={(e) =>
                                  setAudienceName(e.target.value)
                                }
                                placeholder="Name"
                                onKeyDown={(e) => {
                                  if (
                                    e.key === "Enter" &&
                                    audienceEmail.trim()
                                  )
                                    addAudienceRecipient();
                                }}
                              />
                              <Button
                                type="button"
                                onClick={addAudienceRecipient}
                                disabled={
                                  audienceSaving || !audienceEmail.trim()
                                }
                              >
                                {audienceSaving ? (
                                  <Spinner data-icon="inline-start" />
                                ) : (
                                  <PlusIcon data-icon="inline-start" />
                                )}
                                Add
                              </Button>
                            </div>
                            {audienceError && (
                              <FieldError>{audienceError}</FieldError>
                            )}
                          </Field>
                          <Field>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <FieldLabel>Campaign audience</FieldLabel>
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={addOrganizationAudience}
                                  disabled={audienceImporting}
                                >
                                  {audienceImporting ? (
                                    <Spinner data-icon="inline-start" />
                                  ) : (
                                    <UsersRoundIcon data-icon="inline-start" />
                                  )}
                                  {audienceImporting
                                    ? "Adding…"
                                    : "Add org audience"}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setImportOpen(true)}
                                >
                                  <UploadIcon data-icon="inline-start" />
                                  Import file
                                </Button>
                              </div>
                            </div>
                            <div className="overflow-hidden rounded-lg border border-border">
                              {recipients.length > 0 ? (
                                <div className="max-h-64 divide-y divide-border overflow-y-auto">
                                  {recipients.slice(0, 200).map((r) => (
                                    <div
                                      key={r.id}
                                      className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                                    >
                                      <span className="min-w-0">
                                        <span className="block truncate font-medium">
                                          {r.name ||
                                            r.email.split("@")[0]}
                                        </span>
                                        <span className="block truncate text-xs text-muted-foreground">
                                          {r.email}
                                        </span>
                                      </span>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() =>
                                          removeAudienceRecipient(r.id)
                                        }
                                        title="Remove recipient"
                                      >
                                        <Trash2Icon />
                                      </Button>
                                    </div>
                                  ))}
                                  {recipients.length > 200 && (
                                    <div className="px-3 py-2 text-xs text-muted-foreground">
                                      +{recipients.length - 200} more recipient
                                      {recipients.length - 200 === 1 ? "" : "s"}{" "}
                                      — all included in the send
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                                  No recipients on this campaign yet.
                                </div>
                              )}
                            </div>
                          </Field>
                          <Field>
                            <FieldLabel>Do not send to</FieldLabel>
                            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                              This organization&apos;s do-not-mail list is
                              always excluded.
                            </div>
                          </Field>
                        </FieldGroup>
                      </AccordionContent>
                    </AccordionItem>

                    {/* From */}
                    <AccordionItem
                      value="from"
                      className={cn(
                        "border-0 transition-colors duration-200",
                        open === "from" ? "bg-muted/40" : "hover:bg-muted/10"
                      )}
                    >
                      <AccordionTrigger className="px-4 py-3.5 hover:no-underline">
                        <span className="flex min-w-0 items-start gap-3">
                          <StepCircle done={ready.from} num={2} active={open === "from"} />
                          <span className="min-w-0 text-left">
                            <span className="block text-sm font-semibold">
                              From
                            </span>
                            <span className="mt-0.5 block text-xs">
                              <span className="font-medium text-foreground">
                                {campaign.fromName || "No name"}
                              </span>
                              <span className="text-muted-foreground">
                                {" "}
                                —{" "}
                                {campaign.fromEmail || "no email"}
                              </span>
                            </span>
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 pt-1">
                        <FieldGroup className="gap-4">
                          <Field>
                            <FieldLabel htmlFor="from-name">
                              From name
                            </FieldLabel>
                            <Input
                              id="from-name"
                              value={fromName}
                              onChange={(e) => setFromName(e.target.value)}
                              placeholder="LetterStack"
                            />
                          </Field>
                          <Field>
                            <FieldLabel>Sending address</FieldLabel>
                            <div className="flex flex-col gap-2">
                              {sharedFromEmail && (
                                <label
                                  className={cn(
                                    "flex cursor-pointer items-center gap-3 rounded-lg border p-3",
                                    senderSource === "shared"
                                      ? "border-primary bg-primary/5"
                                      : "border-border",
                                  )}
                                >
                                  <input
                                    type="radio"
                                    name="sender-address"
                                    checked={senderSource === "shared"}
                                    onChange={() => setSenderSource("shared")}
                                    className="accent-current"
                                  />
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium">
                                      {sharedFromEmail}
                                    </span>
                                    <span className="block text-xs text-muted-foreground">
                                      Shared LetterStack address — works
                                      immediately
                                    </span>
                                  </span>
                                </label>
                              )}
                              {senderDomains.map((entry) => (
                                <label
                                  key={entry.domain}
                                  className={cn(
                                    "flex items-start gap-3 rounded-lg border p-3",
                                    entry.readyToSend
                                      ? "cursor-pointer"
                                      : "opacity-70",
                                    senderSource === entry.domain
                                      ? "border-primary bg-primary/5"
                                      : "border-border",
                                  )}
                                >
                                  <input
                                    type="radio"
                                    name="sender-address"
                                    checked={senderSource === entry.domain}
                                    disabled={!entry.readyToSend}
                                    onChange={() =>
                                      setSenderSource(entry.domain)
                                    }
                                    className="mt-1 accent-current"
                                  />
                                  <span className="min-w-0 flex-1">
                                    {senderSource === entry.domain ? (
                                      <span className="flex items-center gap-1">
                                        <Input
                                          value={customLocal}
                                          onChange={(e) =>
                                            setCustomLocal(
                                              e.target.value
                                                .toLowerCase()
                                                .replace(/[^a-z0-9._+-]/g, ""),
                                            )
                                          }
                                          placeholder="hello"
                                          className="h-8 min-w-0 flex-1"
                                          aria-label="Sender address name"
                                        />
                                        <span className="shrink-0 text-sm text-muted-foreground">
                                          @{entry.domain}
                                        </span>
                                      </span>
                                    ) : (
                                      <span className="block truncate text-sm font-medium">
                                        @{entry.domain}
                                      </span>
                                    )}
                                    <span className="mt-1 block text-xs text-muted-foreground">
                                      Your connected domain — any address name
                                      works (updates, applications, hello…)
                                    </span>
                                  </span>
                                  {!entry.readyToSend && (
                                    <Badge variant="outline">
                                      Pending verification
                                    </Badge>
                                  )}
                                </label>
                              ))}
                            </div>
                            <FieldDescription>
                              Connect and verify your own domain on the{" "}
                              <Link
                                href="/dashboard/domains"
                                className="underline underline-offset-2"
                              >
                                Domains page
                              </Link>{" "}
                              to send from a branded address.
                            </FieldDescription>
                          </Field>
                          <SaveCancel
                            saving={savingSection === "from"}
                            disabled={!hasDoc}
                            onSave={saveFrom}
                            onCancel={() => setOpen(null)}
                          />
                        </FieldGroup>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Subject */}
                    <AccordionItem
                      value="subject"
                      className={cn(
                        "border-0 transition-colors duration-200",
                        open === "subject" ? "bg-muted/40" : "hover:bg-muted/10"
                      )}
                    >
                      <AccordionTrigger className="px-4 py-3.5 hover:no-underline">
                        <span className="flex min-w-0 items-start gap-3">
                          <StepCircle done={ready.subject} num={3} active={open === "subject"} />
                          <span className="min-w-0 text-left">
                            <span className="block text-sm font-semibold">
                              Subject
                            </span>
                            <span className="mt-0.5 block text-xs">
                              <span className="font-semibold text-foreground">
                                {campaign.subject || "No subject yet"}
                              </span>
                              {previewText && (
                                <span className="text-muted-foreground">
                                  {" "}
                                  · {previewText}
                                </span>
                              )}
                            </span>
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 pt-1">
                        <FieldGroup className="gap-4">
                          <Field>
                            <FieldLabel htmlFor="subject-line">
                              Subject line
                            </FieldLabel>
                            <Input
                              id="subject-line"
                              value={subject}
                              onChange={(e) => setSubject(e.target.value)}
                              placeholder="Your monthly update"
                            />
                          </Field>
                          <Field>
                            <FieldLabel htmlFor="preview-text">
                              Preview text
                            </FieldLabel>
                            <Input
                              id="preview-text"
                              value={previewText}
                              onChange={(e) =>
                                setPreviewText(e.target.value)
                              }
                              placeholder="The short line shown after the subject"
                            />
                          </Field>
                          <SaveCancel
                            saving={savingSection === "subject"}
                            disabled={!hasDoc}
                            onSave={() =>
                              saveSection("subject", (doc) => {
                                doc.subject = subject.trim();
                                doc.settings.previewText =
                                  previewText.trim();
                              })
                            }
                            onCancel={() => setOpen(null)}
                          />
                        </FieldGroup>
                      </AccordionContent>
                    </AccordionItem>

                    {/* Send time */}
                    <AccordionItem
                      value="sendtime"
                      className={cn(
                        "border-0 transition-colors duration-200",
                        open === "sendtime" ? "bg-muted/40" : "hover:bg-muted/10"
                      )}
                    >
                      <AccordionTrigger className="px-4 py-3.5 hover:no-underline">
                        <span className="flex min-w-0 items-start gap-3">
                          <StepCircle done={ready.sendtime} num={4} active={open === "sendtime"} />
                          <span className="min-w-0 text-left">
                            <span className="block text-sm font-semibold">
                              Send time
                            </span>
                            <span className="mt-0.5 block text-xs font-semibold text-foreground">
                              {isScheduled && campaign.scheduledAt
                                ? `Scheduled for ${formatScheduleTime(campaign.scheduledAt)}`
                                : sendMode === "schedule"
                                  ? scheduleAt
                                    ? `Scheduled send · ${formatScheduleTime(new Date(scheduleAt).toISOString())}`
                                    : "Schedule for later"
                                  : "Send now"}
                            </span>
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4 pt-1">
                        <FieldGroup className="gap-3">
                          <label
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-lg border p-3",
                              sendMode === "now"
                                ? "border-primary bg-primary/5"
                                : "border-border hover:bg-muted/20",
                            )}
                          >
                            <input
                              type="radio"
                              name="sendtime-mode"
                              checked={sendMode === "now"}
                              onChange={() => setSendMode("now")}
                              disabled={isScheduled}
                              className="accent-current"
                            />
                            <span className="text-sm font-medium">
                              Send now
                            </span>
                          </label>
                          <label
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-lg border p-3",
                              sendMode === "schedule"
                                ? "border-primary bg-primary/5"
                                : "border-border hover:bg-muted/20",
                            )}
                          >
                            <input
                              type="radio"
                              name="sendtime-mode"
                              checked={sendMode === "schedule"}
                              onChange={() => setSendMode("schedule")}
                              className="accent-current"
                            />
                            <span className="text-sm font-medium">
                              Schedule for later
                            </span>
                          </label>
                          {sendMode === "schedule" && (
                            <Field>
                              <FieldLabel htmlFor="schedule-at">
                                Date &amp; time
                              </FieldLabel>
                              <Input
                                id="schedule-at"
                                type="datetime-local"
                                value={scheduleAt}
                                min={toLocalInputValue(
                                  new Date(Date.now() + 5 * 60 * 1000),
                                )}
                                onChange={(e) => setScheduleAt(e.target.value)}
                              />
                              <FieldDescription>
                                Uses your local time zone. Must be at least a
                                few minutes from now.
                              </FieldDescription>
                              {isScheduled && (
                                <Button
                                  size="sm"
                                  className="self-start"
                                  onClick={scheduleCampaign}
                                  disabled={scheduling || !scheduleAt}
                                >
                                  {scheduling && (
                                    <Spinner data-icon="inline-start" />
                                  )}
                                  {scheduling
                                    ? "Updating…"
                                    : "Update schedule"}
                                </Button>
                              )}
                            </Field>
                          )}
                        </FieldGroup>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  {/* Static: Content */}
                  <div className="flex items-center gap-3 border-t border-border px-4 py-3.5">
                    <StepCircle done={ready.content} num={5} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Content</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Designed in the editor.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSwitchOpen(true)}
                    >
                      <ReplaceIcon data-icon="inline-start" />
                      Switch template
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={editDesign}
                    >
                      <Edit3Icon data-icon="inline-start" />
                      Edit design
                    </Button>
                  </div>

                  {/* Static: Unsubscribe */}
                  <div className="flex items-center gap-3 border-t border-border px-4 py-3.5">
                    <StepCircle done={ready.unsubscribe} num={6} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Unsubscribe link</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {hasUnsubscribe
                          ? "Required link present in the email."
                          : "Add {{unsubscribe_url}} to the email design."}
                      </p>
                    </div>
                  </div>

                  {/* Can't send warning */}
                  {(!canSend || !ready.sendtime) && (
                    <div className="border-t border-border p-4">
                      <Alert>
                        <AlertDescription>
                          {!ready.to
                            ? "Add recipients to this campaign before sending."
                            : !ready.subject
                              ? "Add a subject before sending."
                              : !ready.from
                                ? "Set a from name and email before sending."
                                : !ready.unsubscribe
                                  ? "This email has no unsubscribe link, which is required to send."
                                  : "Pick a date and time in the Send time step to schedule this campaign."}
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </>
              ) : (
                // ── NON-DRAFT: read-only steps ──
                <div className="flex flex-col divide-y divide-border">
                  {[
                    {
                      label: "To",
                      description: `${recipientCount ?? "…"} recipient${recipientCount === 1 ? "" : "s"}`,
                      done: ready.to,
                    },
                    {
                      label: "From",
                      description:
                        campaign.fromName && campaign.fromEmail
                          ? `${campaign.fromName} · ${campaign.fromEmail}`
                          : "Not set",
                      done: ready.from,
                    },
                    {
                      label: "Subject",
                      description: campaign.subject || "No subject",
                      done: ready.subject,
                    },
                    {
                      label: "Send time",
                      description: campaign.scheduledAt
                        ? `Scheduled for ${formatScheduleTime(campaign.scheduledAt)}`
                        : "Sent immediately",
                      done: true,
                    },
                    {
                      label: "Content",
                      description: "HTML snapshot saved",
                      done: true,
                    },
                    {
                      label: "Unsubscribe",
                      description: hasUnsubscribe
                        ? "Required link present"
                        : "Missing link",
                      done: hasUnsubscribe,
                    },
                  ].map((step, i) => (
                    <div
                      key={step.label}
                      className="flex items-center gap-3 px-4 py-3.5"
                    >
                      <StepCircle done={step.done} num={i + 1} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">
                          {step.label}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {step.description}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT: Email preview ── */}
        <div className="hidden min-w-0 lg:flex">
          <Card className="flex flex-1 flex-col p-0 gap-0">
            <CardContent className="flex-1 p-0">
              <div className="overflow-hidden rounded-xl border border-border shadow-sm">
                {/* Mock email client header */}
                <div className="border-b border-border bg-muted/40 px-4 py-3">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-baseline gap-3 text-xs">
                      <span className="w-12 shrink-0 font-medium text-muted-foreground">
                        From
                      </span>
                      <span className="min-w-0 truncate text-foreground">
                        {campaign.fromName
                          ? `${campaign.fromName} <${campaign.fromEmail}>`
                          : campaign.fromEmail || "—"}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-3 text-xs">
                      <span className="w-12 shrink-0 font-medium text-muted-foreground">
                        To
                      </span>
                      <span className="text-foreground">
                        {recipientCount === null
                          ? "—"
                          : `${recipientCount} recipient${recipientCount === 1 ? "" : "s"}`}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-3 text-xs">
                      <span className="w-12 shrink-0 font-medium text-muted-foreground">
                        Subject
                      </span>
                      <span className="min-w-0 truncate font-medium text-foreground">
                        {campaign.subject || "—"}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Email iframe */}
                {campaign.htmlSnapshot ? (
                  <iframe
                    title="Email preview"
                    srcDoc={campaign.htmlSnapshot}
                    sandbox="allow-same-origin"
                    className="block h-[calc(100vh-280px)] min-h-[480px] w-full bg-white"
                  />
                ) : (
                  <div className="flex h-[calc(100vh-280px)] min-h-[480px] items-center justify-center bg-white text-sm text-muted-foreground">
                    No email content yet. Design your email in the editor.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Switch template dialog */}
      <Dialog open={switchOpen} onOpenChange={setSwitchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Switch template</DialogTitle>
            <DialogDescription>
              Replaces this campaign&apos;s design with the chosen template.
              Your recipients, subject, and sender are kept. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <Select value={switchTemplateId} onValueChange={setSwitchTemplateId}>
            <SelectTrigger className="w-full" aria-label="Template">
              <SelectValue placeholder="Choose a template" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="blank">Blank — start from scratch</SelectItem>
              <SelectGroup>
                <SelectLabel>LetterStack templates</SelectLabel>
                {PREBUILT_TEMPLATES.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.title}
                  </SelectItem>
                ))}
              </SelectGroup>
              {savedTemplates.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Your templates</SelectLabel>
                  {savedTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSwitchOpen(false)}
              disabled={switching}
            >
              Cancel
            </Button>
            <Button onClick={switchTemplate} disabled={switching}>
              {switching && <Spinner data-icon="inline-start" />}
              {switching ? "Switching…" : "Switch template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import wizard */}
      {importOpen && (
        <ImportWizard
          endpoint={`/api/campaigns/${campaign.id}/recipients/import`}
          onClose={() => setImportOpen(false)}
          onDone={() => {
            setImportOpen(false);
            loadAudience();
          }}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepCircle({ done, num, active }: { done: boolean; num: number; active?: boolean }) {
  if (done) {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-zinc-950 transition-colors duration-200">
        <CheckIcon className="size-4 stroke-[3]" />
      </span>
    );
  }
  if (active) {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-zinc-950 font-bold text-xs transition-colors duration-200">
        {num}
      </span>
    );
  }
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700/50 font-semibold text-xs transition-colors duration-200">
      {num}
    </span>
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
    <div className="flex items-center gap-2">
      <Button onClick={onSave} disabled={saving || disabled}>
        {saving && <Spinner data-icon="inline-start" />}
        {saving ? "Saving…" : "Save"}
      </Button>
      <Button variant="outline" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

function CampaignStatusBadge({
  status,
  isFinished,
}: {
  status: string;
  isFinished: boolean;
}) {
  if (status === "draft") {
    return <Badge variant="secondary">Draft</Badge>;
  }
  if (status === "scheduled") {
    return (
      <Badge variant="outline">
        <CalendarClockIcon className="size-3" />
        Scheduled
      </Badge>
    );
  }
  if (!isFinished) {
    return (
      <Badge variant="outline">
        <span className="size-1.5 animate-pulse rounded-full bg-current" />
        Sending
      </Badge>
    );
  }
  return (
    <Badge>
      <span className="size-1.5 rounded-full bg-current" />
      Sent
    </Badge>
  );
}

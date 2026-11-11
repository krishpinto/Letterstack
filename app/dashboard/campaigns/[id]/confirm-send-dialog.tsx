"use client";

import { useEffect, useState } from "react";
import {
  CalendarClockIcon,
  FlaskConicalIcon,
  RotateCcwIcon,
  SendIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/coss-dialog";
import { Spinner } from "@/components/ui/spinner";
import { fetchJson } from "@/lib/fetch-json";

// The last stop before a campaign goes to a whole list. It states exactly
// what is about to happen — who, from where, what subject, when, and how
// much of the month's allowance it uses — because the Send button used to
// fire immediately with none of that on screen.

export type SendIntent = "send" | "schedule" | "resume";

type Usage = { used: number; limit: number };

/** "Tue, 12 Nov, 9:30 AM GMT+5:30 (Asia/Kolkata)" */
export function formatWithTimeZone(iso: string) {
  const date = new Date(iso);
  const text = date.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  let zone = "";
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // Older runtimes: the short zone name above is still there.
  }
  return zone ? `${text} (${zone})` : text;
}

export function ConfirmSendDialog({
  open,
  onOpenChange,
  intent,
  recipientCount,
  pendingCount,
  fromName,
  fromEmail,
  subject,
  scheduledAt,
  organizationId,
  viaGmail,
  testSent,
  onSendTest,
  onConfirm,
  confirming,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  intent: SendIntent;
  recipientCount: number;
  /** Resume only: recipients not yet sent. */
  pendingCount?: number;
  fromName: string;
  fromEmail: string;
  subject: string;
  /** Schedule only: ISO time the send will fire. */
  scheduledAt?: string | null;
  organizationId?: string;
  viaGmail: boolean;
  testSent: boolean;
  onSendTest: () => void;
  onConfirm: () => void;
  confirming: boolean;
}) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [usageFailed, setUsageFailed] = useState(false);

  useEffect(() => {
    if (!open || !organizationId || intent === "resume") return;
    let alive = true;
    setUsage(null);
    setUsageFailed(false);
    fetchJson<{ sends: Usage }>(`/api/organizations/${organizationId}/usage`)
      .then((data) => {
        if (alive) setUsage(data.sends);
      })
      .catch(() => {
        if (alive) setUsageFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [open, organizationId, intent]);

  const people = `${recipientCount.toLocaleString()} recipient${recipientCount === 1 ? "" : "s"}`;
  const remaining = usage ? Math.max(0, usage.limit - usage.used) : null;
  const overQuota = remaining !== null && recipientCount > remaining;

  const title =
    intent === "schedule"
      ? `Schedule this campaign for ${people}?`
      : intent === "resume"
        ? "Resume this send?"
        : `Send this campaign to ${people} now?`;

  const confirmLabel =
    intent === "schedule"
      ? "Schedule send"
      : intent === "resume"
        ? "Resume send"
        : `Send to ${people}`;

  const ConfirmIcon =
    intent === "schedule" ? CalendarClockIcon : intent === "resume" ? RotateCcwIcon : SendIcon;

  return (
    <Dialog open={open} onOpenChange={(next) => !confirming && onOpenChange(next)}>
      <DialogPopup className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {intent === "resume"
              ? `LetterStack re-queues the ${(pendingCount ?? 0).toLocaleString()} recipient${pendingCount === 1 ? "" : "s"} still waiting. Anyone already sent to, or already marked failed, is never sent again.`
              : intent === "schedule"
                ? "It goes out automatically at the time below. You can edit, reschedule or cancel it until then."
                : "It starts going out as soon as you confirm. A sent email can't be recalled."}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="flex flex-col gap-4">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
            <dt className="text-muted-foreground">To</dt>
            <dd className="font-medium">
              {intent === "resume"
                ? `${(pendingCount ?? 0).toLocaleString()} remaining of ${people}`
                : `Up to ${people}`}
            </dd>
            <dt className="text-muted-foreground">From</dt>
            <dd className="min-w-0 break-words">
              {fromName ? `${fromName} <${fromEmail}>` : fromEmail}
            </dd>
            <dt className="text-muted-foreground">Subject</dt>
            <dd className="min-w-0 break-words font-medium">{subject}</dd>
            {intent === "schedule" && scheduledAt && (
              <>
                <dt className="text-muted-foreground">When</dt>
                <dd className="min-w-0 break-words">{formatWithTimeZone(scheduledAt)}</dd>
              </>
            )}
            {intent !== "resume" && (
              <>
                <dt className="text-muted-foreground">Quota</dt>
                <dd className="min-w-0 break-words">
                  {usage && remaining !== null ? (
                    <>
                      Uses up to {recipientCount.toLocaleString()} of your{" "}
                      {remaining.toLocaleString()} remaining emails this month (
                      {usage.used.toLocaleString()} of {usage.limit.toLocaleString()}{" "}
                      used)
                    </>
                  ) : usageFailed || !organizationId ? (
                    <>
                      Uses up to {recipientCount.toLocaleString()} emails from your
                      monthly allowance
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <Spinner className="size-3.5" />
                      Checking your allowance…
                    </span>
                  )}
                  {viaGmail && (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Also counts towards this Gmail account&apos;s daily sending limit.
                    </span>
                  )}
                </dd>
              </>
            )}
          </dl>

          <p className="text-xs text-muted-foreground">
            Suppressed, bounced and unsubscribed addresses are skipped
            automatically, so the final count can be lower.
          </p>

          {overQuota && (
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertDescription>
                This needs up to {recipientCount.toLocaleString()} emails but only{" "}
                {remaining?.toLocaleString()} are left this month, so the send will be
                refused. Remove some recipients or upgrade in Settings → Billing.
              </AlertDescription>
            </Alert>
          )}

          {!testSent && intent !== "resume" && (
            <Alert>
              <FlaskConicalIcon />
              <AlertDescription className="flex flex-col items-start gap-2">
                You haven&apos;t sent yourself a test of this campaign yet. It&apos;s
                the easiest way to catch a broken link or image.
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onSendTest}
                  disabled={confirming}
                >
                  Send a test first
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </DialogPanel>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={confirming}>
            {confirming ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <ConfirmIcon data-icon="inline-start" />
            )}
            {confirming
              ? intent === "schedule"
                ? "Scheduling…"
                : intent === "resume"
                  ? "Resuming…"
                  : "Sending…"
              : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

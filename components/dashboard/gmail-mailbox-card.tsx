"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  Loader2Icon,
  MailIcon,
  Trash2Icon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { confirmDialog } from "@/components/app-dialogs";

type Mailbox = {
  id: string;
  email: string;
  displayName: string | null;
  status: "active" | "error" | "revoked";
  lastError: string | null;
  dailyLimit: number;
  sentToday: number;
};

/**
 * Self-fetching, same pattern as the admin panels elsewhere in the app —
 * independent load/refresh cycle rather than folded into the domains
 * page's own /api/domains fetch, since this is a genuinely separate
 * resource (a per-user Gmail connection, not an org-wide domain).
 */
export function GmailMailboxCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mailboxes, setMailboxes] = useState<Mailbox[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [callbackNotice, setCallbackNotice] = useState<
    { status: "connected" | "error"; message?: string } | null
  >(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/senders/gmail/mailboxes");
      const data = await response.json();
      if (data.ok) setMailboxes(data.mailboxes);
    } catch {
      // keep the last snapshot
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Read the connect-flow's redirect result once, then strip it from the
  // URL so a refresh doesn't re-show a stale notice.
  useEffect(() => {
    const gmail = searchParams.get("gmail");
    if (gmail === "connected" || gmail === "error") {
      setCallbackNotice({
        status: gmail,
        message: searchParams.get("gmail_error") ?? undefined,
      });
      router.replace("/dashboard/domains", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function connect() {
    window.location.href = "/api/senders/gmail/connect";
  }

  async function disconnect(mailbox: Mailbox) {
    const ok = await confirmDialog({
      title: `Disconnect ${mailbox.email}?`,
      description: "Campaigns can no longer send through it until it's reconnected.",
      confirmLabel: "Disconnect",
      destructive: true,
    });
    if (!ok) return;

    setBusy(mailbox.id);
    try {
      await fetch(`/api/senders/gmail/mailboxes/${mailbox.id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-4">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MailIcon className="size-5" />
        </span>
        <div>
          <CardTitle>Gmail account</CardTitle>
          <CardDescription>
            No domain to verify? Connect your own Gmail account and send from
            it instead — same editor, same campaigns, sent as a real Gmail
            message.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {callbackNotice?.status === "connected" && (
          <Alert>
            <CheckCircle2Icon />
            <AlertTitle>Gmail connected</AlertTitle>
            <AlertDescription>
              You can pick it as a sender the next time you send a campaign.
            </AlertDescription>
          </Alert>
        )}
        {callbackNotice?.status === "error" && (
          <Alert variant="destructive">
            <AlertTriangleIcon />
            <AlertTitle>Couldn&apos;t connect Gmail</AlertTitle>
            <AlertDescription>
              {callbackNotice.message || "Something went wrong. Try again."}
            </AlertDescription>
          </Alert>
        )}

        {mailboxes === null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Loading…
          </div>
        ) : mailboxes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Not connected yet. Only you can send through a Gmail account you
            connect — it isn&apos;t shared with teammates, the way a
            verified domain is.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {mailboxes.map((mailbox) => (
              <div
                key={mailbox.id}
                className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-medium">
                    {mailbox.email}
                  </span>
                  {mailbox.status === "active" && <Badge>Connected</Badge>}
                  {mailbox.status === "error" && (
                    <Badge variant="destructive">Needs reconnect</Badge>
                  )}
                  {mailbox.status === "revoked" && (
                    <Badge variant="outline">Disconnected</Badge>
                  )}
                </div>

                {mailbox.status === "active" && (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Sent today</span>
                      <span>
                        {mailbox.sentToday} / {mailbox.dailyLimit}
                      </span>
                    </div>
                    <Progress
                      value={Math.min(
                        100,
                        (mailbox.sentToday / Math.max(1, mailbox.dailyLimit)) * 100,
                      )}
                      className="h-1.5"
                    />
                  </div>
                )}

                {mailbox.status === "error" && (
                  <p className="text-xs text-muted-foreground">
                    {mailbox.lastError ||
                      "Gmail access needs to be reconnected before this can send again."}
                  </p>
                )}

                <div className="flex gap-2">
                  {mailbox.status !== "active" && (
                    <Button size="sm" variant="outline" onClick={connect}>
                      Reconnect
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => void disconnect(mailbox)}
                  >
                    {busy === mailbox.id ? (
                      <Loader2Icon data-icon="inline-start" className="animate-spin" />
                    ) : (
                      <Trash2Icon data-icon="inline-start" />
                    )}
                    Disconnect
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="w-full" onClick={connect}>
          <MailIcon data-icon="inline-start" />
          {mailboxes && mailboxes.length > 0 ? "Connect another Gmail account" : "Connect Gmail"}
        </Button>
      </CardFooter>
    </Card>
  );
}

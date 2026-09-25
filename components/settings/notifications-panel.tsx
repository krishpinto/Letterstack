"use client";

import { useCallback, useEffect, useState } from "react";
import { TriangleAlertIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  NOTIFICATION_INFO,
  NOTIFICATION_KINDS,
  type NotificationKind,
  type NotificationPreferences,
} from "@/lib/notifications/preferences";

/**
 * Settings → Notifications.
 *
 * Saves on toggle rather than behind the SaveBar the other panels use. A
 * switch that has visibly moved but has not taken effect is its own bug
 * report, and there is nothing here to review as a set before committing.
 *
 * Every toggle maps to mail that actually gets sent — campaign reports from
 * finalizeCampaignIfDone, deliverability warnings from the SES webhook. That
 * is the constraint this panel is written under: a switch for a notification
 * nothing emits is worse than no switch, because it reads as a promise that
 * mail is being suppressed when none was ever coming.
 */

export function NotificationsPanel({ userEmail }: { userEmail: string }) {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<NotificationKind | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/account/notifications");
      const data = await response.json().catch(() => null);
      if (!data?.ok) throw new Error(data?.error || "Could not load notification settings");
      setPrefs(data.preferences);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load notification settings");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(kind: NotificationKind, value: boolean) {
    if (!prefs) return;
    const previous = prefs;

    // Optimistic, then reconciled against what came back. A switch should
    // move when it is clicked; a failure puts it back and says why.
    setPrefs({ ...prefs, [kind]: value });
    setPending(kind);
    setError(null);

    try {
      const response = await fetch("/api/account/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: { [kind]: value } }),
      });
      const data = await response.json().catch(() => null);
      if (!data?.ok) throw new Error(data?.error || "Could not save that");
      setPrefs(data.preferences);
    } catch (err) {
      setPrefs(previous);
      setError(err instanceof Error ? err.message : "Could not save that");
    } finally {
      setPending(null);
    }
  }

  if (!prefs) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        {error ? (
          <span className="text-destructive">{error}</span>
        ) : (
          <>
            <Spinner className="size-4" />
            Loading notification settings…
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex max-w-lg flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-sm font-semibold">Email notifications</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Sent to <span className="font-medium text-foreground">{userEmail}</span>.
            These are your own settings, for this workspace only — teammates
            choose separately, and joining another workspace starts fresh.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-1">
          {NOTIFICATION_KINDS.map((kind, index) => {
            const info = NOTIFICATION_INFO[kind];
            return (
              <div key={kind}>
                {index > 0 && <Separator className="my-1" />}
                <div className="flex items-start justify-between gap-4 py-2.5">
                  <div className="min-w-0">
                    <Label
                      htmlFor={`notify-${kind}`}
                      className="flex items-center gap-1.5 text-sm font-medium"
                    >
                      {info.label}
                      {info.important && (
                        <TriangleAlertIcon className="size-3 text-amber-500" />
                      )}
                    </Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {info.description}
                    </p>
                  </div>
                  <Switch
                    id={`notify-${kind}`}
                    className="mt-0.5 shrink-0"
                    checked={prefs[kind]}
                    disabled={pending === kind}
                    onCheckedChange={(value) => void toggle(kind, value)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold">Always sent</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Not covered by the switches above, because they are how you get into
            your account rather than news about it.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-xs text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Password resets</span>{" "}
            and{" "}
            <span className="font-medium text-foreground">
              workspace invitations
            </span>
            , when you or someone on your team asks for one.
          </p>
          <p>
            Turning off deliverability warnings does not turn off the protection
            itself: an address that hard bounces or reports spam is added to your
            suppression list immediately, whatever these settings say. The
            warning tells you it happened — it is not what makes it happen.
          </p>
        </div>
      </div>
    </div>
  );
}

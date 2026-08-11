"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, ZapIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Shown once, to each person, the first time they land in the app after
 * being put on the free Pro trial.
 *
 * Opens on mount rather than behind a trigger — it's an announcement, not
 * something anyone went looking for. Dismissal is recorded server-side (not
 * in localStorage) so it doesn't reappear on another device, and so the flag
 * survives someone clearing site data.
 */
export function TrialAnnouncement({
  expiresAt,
  daysLeft,
  trialDays,
}: {
  /** Null when the countdown hasn't started — nothing has been sent yet. */
  expiresAt: string | null;
  daysLeft: number | null;
  trialDays: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // One tick after mount so the dialog animates in rather than appearing
  // already-open in the first painted frame.
  useEffect(() => {
    const id = window.setTimeout(() => setOpen(true), 400);
    return () => window.clearTimeout(id);
  }, []);

  async function dismiss() {
    setOpen(false);
    try {
      await fetch("/api/plan/notice", { method: "POST" });
      // Re-render the server components so this doesn't flash back on the
      // next navigation before the layout re-reads the flag.
      router.refresh();
    } catch {
      // A failed dismissal is not worth an error state — the dialog is
      // already closed for this session, and it'll simply show once more.
    }
  }

  const until = expiresAt
    ? new Date(expiresAt).toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-amber-400/15 text-amber-600 dark:text-amber-400">
            <ZapIcon className="size-5" />
          </span>
          <DialogTitle className="text-xl">
            Your workspace is now on Pro
          </DialogTitle>
          <DialogDescription>
            {until ? (
              <>
                Every Pro feature is unlocked on your workspace through{" "}
                <strong className="text-foreground">{until}</strong>, on us —
                nothing to pay and no card needed. Nothing changes about how you
                work today.
              </>
            ) : (
              <>
                Every Pro feature is unlocked on your workspace, on us — nothing
                to pay and no card needed. Your{" "}
                <strong className="text-foreground">{trialDays} days</strong>{" "}
                start when you send your first campaign, so nothing runs down
                while you&rsquo;re still setting up.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-2.5 py-1">
          {[
            "3,000 contacts",
            "15,000 emails a month",
            "2 sending domains",
            "Unlimited signup forms",
            "Full analytics history",
          ].map((feature) => (
            <li key={feature} className="flex items-center gap-2.5 text-sm">
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CheckIcon className="size-2.5" />
              </span>
              {feature}
            </li>
          ))}
        </ul>

        <p className="text-xs leading-5 text-muted-foreground">
          {daysLeft !== null
            ? `We'll remind you here before it runs out, ${daysLeft} days from now.`
            : "We'll remind you here before it runs out."}{" "}
          Everything you make stays yours either way.
        </p>

        <DialogFooter>
          <Button onClick={dismiss} className="w-full sm:w-auto">
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

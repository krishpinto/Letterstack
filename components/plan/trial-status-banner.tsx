"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangleIcon, ClockIcon, XIcon } from "lucide-react";

import {
  PLAN_NOTICE_DISMISSED_COOKIE,
  type PlanNotice,
} from "@/lib/plans/notice";

const SIX_MONTHS = 60 * 60 * 24 * 180;

/**
 * The standing reminder that a trial or paid period is running out, and the
 * notice that it already has.
 *
 * Dismissible — but the notice doesn't disappear, it moves. Closing this
 * writes the notice id to a cookie the server layout reads, so the bar is
 * gone from the next render onwards with no flash; the same notice keeps
 * living in the notifications bell in the top navbar, which ignores
 * dismissal entirely. That's what makes the close button safe: the earlier
 * "deliberately not dismissible" rule here existed because a closed banner
 * used to mean a lost warning, and now it doesn't.
 *
 * Dismissal is recorded per notice id, so it lapses on its own — see
 * PlanNotice.id. Renders nothing until there's something worth saying, so
 * it's safe to mount unconditionally in the layout.
 */
export function TrialStatusBanner({ notice }: { notice: PlanNotice | null }) {
  const [dismissed, setDismissed] = useState(false);

  if (!notice || dismissed) return null;

  function dismiss() {
    if (!notice) return;
    document.cookie = `${PLAN_NOTICE_DISMISSED_COOKIE}=${encodeURIComponent(
      notice.id,
    )}; path=/; max-age=${SIX_MONTHS}; samesite=lax`;
    setDismissed(true);
  }

  const ended = notice.kind === "ended";

  return (
    <div
      className={
        ended
          ? "flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-sm sm:px-6"
          : "flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border bg-muted/40 px-4 py-2.5 text-sm sm:px-6"
      }
    >
      {ended ? (
        <AlertTriangleIcon className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      ) : (
        <ClockIcon className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className="font-medium">{notice.title}</span>
      <span className="text-muted-foreground">{notice.body}</span>
      <Link
        href={notice.actionHref}
        className="font-medium text-primary underline-offset-4 hover:underline"
      >
        {notice.actionLabel}
      </Link>
      {/* ms-auto, not a fixed position: the bar wraps to two lines on narrow
          viewports, and the close button should sit at the end of the text
          either way rather than float over it. */}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss — this stays in your notifications"
        className="ms-auto shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  );
}

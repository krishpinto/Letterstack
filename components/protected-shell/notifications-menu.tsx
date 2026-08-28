"use client";

import Link from "next/link";
import { AlertTriangleIcon, BellIcon, ClockIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type PlanNotice } from "@/lib/plans/notice";

/**
 * The bell in the top navbar. Until now it was an inert button; it's the
 * standing home for anything the workspace needs to know but shouldn't be
 * nagged about, starting with the plan notice.
 *
 * Deliberately ignores the banner's dismissal. Closing the bar is "I've read
 * it", not "it's no longer true", so the notice stays here for the whole
 * period and the dot stays lit — that's what lets the bar have a close
 * button at all.
 *
 * Plan state is the only source today. When there's a second kind of notice,
 * this takes a PlanNotice[] instead and the empty state stops being an
 * either/or.
 */
export function NotificationsMenu({ notice }: { notice: PlanNotice | null }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-8 rounded-lg text-muted-foreground hover:text-foreground"
          aria-label={notice ? "Notifications (1 unread)" : "Notifications"}
        >
          <BellIcon className="size-4" />
          {notice && (
            // ring-background, not a gap: the dot overlaps the bell glyph,
            // and a ring in the bar's own colour is what separates the two
            // without needing to nudge the icon off-centre.
            <span
              aria-hidden
              className="absolute right-1.5 top-1.5 size-2 rounded-full bg-amber-500 ring-2 ring-background"
            />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-3 py-2.5">
          <p className="text-sm font-medium">Notifications</p>
        </div>

        {notice ? (
          // Not a DropdownMenuItem: this is a block of copy with its own
          // link inside it, and a menu item would swallow the click and
          // close the menu wherever you happened to press.
          <div className="flex gap-3 px-3 py-3">
            {notice.kind === "ended" ? (
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            ) : (
              <ClockIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-sm font-medium leading-snug">{notice.title}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {notice.body}
              </p>
              <Link
                href={notice.actionHref}
                className="mt-1 w-fit text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                {notice.actionLabel}
              </Link>
            </div>
          </div>
        ) : (
          <div className="px-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              You&rsquo;re all caught up.
            </p>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

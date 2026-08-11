import Link from "next/link";
import { AlertTriangleIcon, ClockIcon } from "lucide-react";

/**
 * The standing reminder that a trial or paid period is running out, and the
 * notice that it already has.
 *
 * Deliberately not dismissible. The announcement dialog is the thing someone
 * acknowledges once; this is the thing that has to still be true on the day
 * they try to send and can't. A banner that can be closed is a banner that
 * will be closed and then missed.
 *
 * Renders nothing at all until there's something worth saying, so it's safe
 * to mount unconditionally in the layout.
 */
export function TrialStatusBanner({
  isTrial,
  trialEnded,
  isExpiringSoon,
  daysLeft,
  expiresAt,
}: {
  isTrial: boolean;
  trialEnded: boolean;
  isExpiringSoon: boolean;
  daysLeft: number | null;
  expiresAt: string | null;
}) {
  if (trialEnded) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-sm sm:px-6">
        <AlertTriangleIcon className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="font-medium">Your Pro plan has ended.</span>
        <span className="text-muted-foreground">
          Your workspace is on the Free plan — everything you&rsquo;ve made is
          still here, but sending and contact limits are lower.
        </span>
        <Link
          href="/dashboard/settings?tab=billing"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          See plans
        </Link>
      </div>
    );
  }

  if (!isExpiringSoon || daysLeft === null) return null;

  const until = expiresAt
    ? new Date(expiresAt).toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
      })
    : null;
  // "tomorrow" and "today" read as urgent in a way "in 1 days" never does.
  const when =
    daysLeft === 0 ? "today" : daysLeft === 1 ? "tomorrow" : `in ${daysLeft} days`;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border bg-muted/40 px-4 py-2.5 text-sm sm:px-6">
      <ClockIcon className="size-4 shrink-0 text-muted-foreground" />
      <span className="font-medium">
        Your Pro plan ends {when}
        {until && daysLeft > 1 ? ` (${until})` : ""}.
      </span>
      <span className="text-muted-foreground">
        {isTrial
          ? "Continue on Pro for ₹499 a month, or ₹4,999 a year."
          : "Renew to keep your current limits."}
      </span>
      <Link
        href="/dashboard/settings?tab=billing"
        className="font-medium text-primary underline-offset-4 hover:underline"
      >
        {isTrial ? "Continue on Pro" : "Renew"}
      </Link>
    </div>
  );
}

import { cn } from "@/lib/utils";

// Plane-style campaign state icons: one small SVG per status, colored by
// lifecycle — gray dashed (draft), blue clock (scheduled), amber progress
// ring (sending), green check (sent), red cross (failed).

type CampaignStatusIconProps = {
  status: string;
  className?: string;
};

export function CampaignStatusIcon({ status, className }: CampaignStatusIconProps) {
  const base = cn("size-3.5 shrink-0", className);

  if (status === "sent") {
    return (
      <svg viewBox="0 0 16 16" className={cn(base, "text-emerald-500")} aria-hidden>
        <circle cx="8" cy="8" r="7" className="fill-current" />
        <path
          d="M5 8.2 7.2 10.4 11 6"
          fill="none"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (status === "sending") {
    return (
      <svg viewBox="0 0 16 16" className={cn(base, "text-amber-500")} aria-hidden>
        <circle
          cx="8"
          cy="8"
          r="6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          opacity="0.25"
        />
        {/* ~65% progress arc, starting at 12 o'clock */}
        <circle
          cx="8"
          cy="8"
          r="6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeDasharray="24.5 37.7"
          transform="rotate(-90 8 8)"
        />
      </svg>
    );
  }

  if (status === "scheduled") {
    return (
      <svg viewBox="0 0 16 16" className={cn(base, "text-sky-500")} aria-hidden>
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M8 5v3.2l2.2 1.3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (status === "failed") {
    return (
      <svg viewBox="0 0 16 16" className={cn(base, "text-red-500")} aria-hidden>
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M6.2 6.2 9.8 9.8M9.8 6.2 6.2 9.8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  // Draft / unknown: dashed backlog circle.
  return (
    <svg viewBox="0 0 16 16" className={cn(base, "text-muted-foreground/70")} aria-hidden>
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeDasharray="2.4 2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// Shared by the analytics tab (provider limits) and the users tab (a
// workspace's monthly send allowance). One definition so "70% is amber" means
// the same thing wherever a bar appears.

/** Color a usage percentage: fine → warm → red. */
export function usageTone(pct: number) {
  if (pct >= 90) return "text-red-500";
  if (pct >= 70) return "text-amber-500";
  return "text-emerald-500";
}

export function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function LimitBar({
  used,
  limit,
  format,
}: {
  used: number;
  limit: number;
  format?: (n: number) => string;
}) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const fmt = format ?? ((n: number) => n.toLocaleString());
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className={cn("font-semibold tabular-nums", usageTone(pct))}>
          {fmt(used)}
        </span>
        <span className="text-xs text-muted-foreground">
          of {fmt(limit)} ({pct.toFixed(pct < 10 ? 1 : 0)}%)
        </span>
      </div>
      <Progress value={pct} />
    </div>
  );
}

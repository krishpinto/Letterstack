"use client";

import { RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatUpdatedAgo } from "@/lib/analytics/refresh";
import { useNow } from "@/lib/analytics/use-auto-refresh";
import { cn } from "@/lib/utils";

/**
 * "Updated 2 min ago · Refresh" for pages that refresh themselves. A failed
 * background refresh keeps the old numbers on screen and says so here,
 * instead of silently showing stale data.
 */
export function RefreshStatus({
  updatedAt,
  refreshing,
  error,
  onRefresh,
  className,
}: {
  updatedAt: number | null;
  refreshing: boolean;
  /** Message from the last failed refresh, if it failed. */
  error?: string | null;
  onRefresh: () => void;
  className?: string;
}) {
  const now = useNow();
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <span
        className={cn("min-w-0 truncate", error && "text-destructive")}
        role={error ? "alert" : undefined}
        title={error ?? undefined}
      >
        {error
          ? `Couldn't refresh: ${error}`
          : formatUpdatedAgo(updatedAt, now)}
      </span>
      <Button
        variant="outline"
        size="xs"
        onClick={onRefresh}
        disabled={refreshing}
      >
        {refreshing ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <RefreshCwIcon data-icon="inline-start" />
        )}
        Refresh
      </Button>
    </div>
  );
}

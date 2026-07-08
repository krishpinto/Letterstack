import type { LucideIcon } from "lucide-react";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Nested-border chrome like ChartCard, but FLIPPED vs. it and vs. every other
// overview card: the bg-card (dark) panel with the number sits on TOP, and the
// muted (grey) strip holding the icon + heading sits at the BOTTOM. That inverse
// makes these KPI cards read differently from the top-heading cards around them.
//
// The panel's meta row is a fixed height and nothing is conditionally added or
// removed, so an empty org's card is the exact same shape as a full one — only
// the text/badge inside changes.

type StatFrameCardProps = {
  label: string;
  value: string;
  subValue?: string;
  trend?: {
    value: number; // +/- percentage
    label?: string;
  };
  icon?: LucideIcon;
  className?: string;
};

function StatFrameCard({
  label,
  value,
  subValue,
  trend,
  icon: Icon,
  className,
}: StatFrameCardProps) {
  const isPositive = trend && trend.value >= 0;
  // Caption on the panel's meta row: the trend's "vs last week", else the
  // sub-value (e.g. "3 unique opens"), else nothing — height is fixed either way.
  const caption = trend?.label ?? subValue ?? "";

  return (
    <Card
      className={cn(
        "overflow-hidden rounded-[1.375rem] border border-border bg-muted p-1 pb-0 gap-0",
        className,
      )}
    >
      {/* Dark panel on top — meta caption + trend badge, then the big value */}
      <div className="rounded-[1.125rem] border border-border bg-card px-4 pb-4 pt-3">
        <div className="flex h-6 items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">{caption}</span>
          {trend ? (
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 gap-1 text-xs font-normal tabular-nums",
                isPositive
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                  : "border-destructive/30 bg-destructive/10 text-destructive",
              )}
            >
              {isPositive ? (
                <TrendingUpIcon className="size-3" />
              ) : (
                <TrendingDownIcon className="size-3" />
              )}
              {isPositive ? "+" : ""}
              {trend.value}%
            </Badge>
          ) : null}
        </div>
        <p className="mt-1.5 text-3xl font-semibold tabular-nums tracking-tight">
          {value}
        </p>
      </div>

      {/* Grey strip at the bottom — icon + heading */}
      <div className="flex items-center gap-1.5 px-3 py-2 text-muted-foreground">
        {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}
        <span className="text-sm">{label}</span>
      </div>
    </Card>
  );
}

export { StatFrameCard };

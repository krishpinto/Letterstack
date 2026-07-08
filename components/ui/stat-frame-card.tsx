import type { LucideIcon } from "lucide-react";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Nested-border chrome like ChartCard (outer muted frame + inner bg-card panel),
// but INVERTED vs. the rest of the overview: the meta/trend sits on top, the big
// number in the middle, and the icon + label pinned to the bottom — so these KPI
// cards read differently from every other top-heading card on the page.
//
// The top strip is a fixed height and the layout never conditionally adds a
// footer, so a card with no data (empty org) has the exact same shape as a full
// one — only the text inside the strip differs.

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
  // Caption on the top strip: the trend's "vs last week", else the sub-value
  // (e.g. "3 unique opens"), else nothing — the strip keeps its height either way.
  const caption = trend?.label ?? subValue ?? "";

  return (
    <Card
      className={cn(
        "overflow-hidden rounded-[1.375rem] border border-border bg-muted p-1 pt-0 gap-0",
        className,
      )}
    >
      {/* Top strip — trend caption + badge, fixed height for empty/full parity */}
      <div className="flex h-9 items-center justify-between gap-2 px-3">
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

      {/* Inner panel — value up top, icon + label pinned to the bottom */}
      <div className="flex min-h-[104px] flex-col rounded-[1.125rem] border border-border bg-card px-4 pb-3.5 pt-4">
        <p className="text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
        <div className="mt-auto flex items-center gap-1.5 pt-4 text-muted-foreground">
          {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}
          <span className="text-sm">{label}</span>
        </div>
      </div>
    </Card>
  );
}

export { StatFrameCard };

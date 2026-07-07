import type { LucideIcon } from "lucide-react";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Same nested-border chrome as ChartCard (outer muted frame, inner bg-card
// panel) but holding a stat value instead of a chart — for KPI grids that
// want that framed look without an actual chart underneath.

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

  return (
    <Card
      className={cn(
        "overflow-hidden rounded-[1.375rem] border border-border bg-muted p-1 pt-0 gap-0",
        className,
      )}
    >
      <div className="flex items-center gap-1 px-3 py-1.5">
        {Icon ? <Icon className="size-3 text-muted-foreground" aria-hidden="true" /> : null}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="overflow-hidden rounded-[1.125rem] border border-border bg-card">
        <CardContent className="flex items-center justify-between gap-3 px-4 py-3.5">
          <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
          {trend && (
            <Badge
              variant="outline"
              className={cn(
                "gap-1 text-xs font-normal tabular-nums",
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
          )}
        </CardContent>
        {(subValue || trend?.label) && (
          <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
            {subValue ?? trend?.label}
          </div>
        )}
      </div>
    </Card>
  );
}

export { StatFrameCard };

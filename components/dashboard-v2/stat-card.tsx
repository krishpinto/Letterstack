import type { LucideIcon } from "lucide-react";
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatCardProps = {
  label: string;
  value: string;
  subValue?: string;
  trend?: {
    value: number; // +/- percentage
    label?: string;
  };
  icon: LucideIcon;
  variant?: "default" | "primary" | "success" | "warning" | "danger";
  className?: string;
};

const variantStyles = {
  default: {
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
  },
  primary: {
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
  },
  success: {
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
  },
  warning: {
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-500",
  },
  danger: {
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
  },
};

export function StatCard({
  label,
  value,
  subValue,
  trend,
  icon: Icon,
  variant = "default",
  className,
}: StatCardProps) {
  const styles = variantStyles[variant];
  const isPositive = trend && trend.value >= 0;

  return (
    <Card className={cn("relative overflow-hidden transition-shadow hover:shadow-md", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2 pt-4 px-4">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            styles.iconBg,
            styles.iconColor,
          )}
        >
          <Icon className="size-4" />
        </span>
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
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="mt-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-2xl font-semibold tracking-tight">{value}</p>
          {subValue && (
            <p className="mt-0.5 text-xs text-muted-foreground">{subValue}</p>
          )}
          {trend?.label && (
            <p className="mt-0.5 text-xs text-muted-foreground">{trend.label}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

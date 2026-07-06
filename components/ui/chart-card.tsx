import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ChartCardProps = Omit<ComponentProps<typeof Card>, "title"> & {
  title: ReactNode;
  icon?: LucideIcon;
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  labelClassName?: string;
  panelClassName?: string;
  headerClassName?: string;
  contentClassName?: string;
};

function ChartCard({
  title,
  icon: Icon,
  header,
  children,
  footer,
  className,
  labelClassName,
  panelClassName,
  headerClassName,
  contentClassName,
  ...props
}: ChartCardProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden rounded-[1.375rem] border border-border bg-muted p-1 pt-0 gap-0",
        className,
      )}
      {...props}
    >
      <div className={cn("flex items-center gap-1 px-3 py-1.5", labelClassName)}>
        {Icon ? <Icon className="size-3 text-muted-foreground" aria-hidden="true" /> : null}
        <span className="text-sm text-muted-foreground">{title}</span>
      </div>
      <div
        className={cn(
          "overflow-hidden rounded-[1.125rem] border border-border bg-card",
          panelClassName,
        )}
      >
        {header ? (
          <CardHeader className={cn("px-6 pb-2 pt-6", headerClassName)}>
            {header}
          </CardHeader>
        ) : null}
        <CardContent className={cn("p-0", contentClassName)}>{children}</CardContent>
        {footer}
      </div>
    </Card>
  );
}

export { ChartCard };

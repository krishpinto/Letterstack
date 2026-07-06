import Link from "next/link";
import { type LucideIcon, ArrowRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type QuickAction = {
  href: string;
  title: string;
  description: string;
  cta: string;
  icon: LucideIcon;
  accentClass?: string; // e.g. "text-violet-400" for icon color override
};

type QuickActionsGridProps = {
  actions: QuickAction[];
};

export function QuickActionsGrid({ actions }: QuickActionsGridProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {actions.map((action) => {
        const Icon = action.icon;

        return (
          <Link key={action.href} href={action.href} className="group block">
            <Card className="h-full transition-all duration-200 hover:border-border/80 hover:shadow-md hover:-translate-y-0.5">
              <CardHeader className="pb-2">
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-muted/80",
                    action.accentClass,
                  )}
                >
                  <Icon className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </span>
              </CardHeader>
              <CardContent className="pb-4">
                <CardTitle className="text-sm font-medium leading-snug">
                  {action.title}
                </CardTitle>
                <CardDescription className="mt-1 text-xs leading-relaxed">
                  {action.description}
                </CardDescription>
                <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary">
                  {action.cta}
                  <ArrowRightIcon className="size-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

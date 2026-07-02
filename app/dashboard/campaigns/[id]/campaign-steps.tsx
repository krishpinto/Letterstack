import { CheckIcon, ChevronRightIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type CampaignStep = {
  label: string;
  description: string;
  done: boolean;
  current?: boolean;
};

export function CampaignSteps({
  steps,
  title = "Campaign setup",
  description = "The same send checklist, kept visible for monitoring.",
}: {
  steps: CampaignStep[];
  title?: string;
  description?: string;
}) {
  const doneCount = steps.filter((step) => step.done).length;
  const progress = steps.length > 0 ? (doneCount / steps.length) * 100 : 0;

  return (
    <Card className="h-fit overflow-hidden">
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge variant="outline" className="tabular-nums">
            {doneCount}/{steps.length}
          </Badge>
        </div>
        <Progress value={progress} />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {steps.map((step, index) => (
          <div
            key={step.label}
            className={cn(
              "flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors",
              step.current && !step.done && "bg-muted/50",
            )}
          >
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-medium tabular-nums",
                step.done
                  ? "border-primary bg-primary text-primary-foreground"
                  : step.current
                    ? "border-foreground bg-background text-foreground"
                    : "border-border bg-muted text-muted-foreground",
              )}
            >
              {step.done ? <CheckIcon className="size-4" /> : index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  "block truncate text-sm font-medium",
                  !step.done && !step.current && "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {step.description}
              </span>
            </span>
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

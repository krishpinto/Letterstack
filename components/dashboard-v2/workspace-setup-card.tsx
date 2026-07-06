import {
  CheckCircle2Icon,
  ChevronRightIcon,
  CircleDotIcon,
  GlobeIcon,
  MailPlusIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type SetupStep = {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  status: "done" | "ready" | "soon";
  href?: string;
};

const statusConfig = {
  done: {
    label: "Done",
    badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
    iconClass: "text-emerald-500",
  },
  ready: {
    label: "Set up",
    badgeClass: "border-primary/30 bg-primary/10 text-primary",
    iconClass: "text-primary",
  },
  soon: {
    label: "Soon",
    badgeClass: "border-muted-foreground/20 bg-muted text-muted-foreground",
    iconClass: "text-muted-foreground",
  },
};

const SETUP_STEPS: SetupStep[] = [
  {
    id: "org",
    label: "Profile & organization",
    description: "Your workspace is created and ready.",
    icon: CheckCircle2Icon,
    status: "done",
  },
  {
    id: "domain",
    label: "Connect sender domain",
    description: "Verify DNS records for custom sending.",
    icon: GlobeIcon,
    status: "ready",
    href: "/dashboard/domains",
  },
  {
    id: "audience",
    label: "Import audience contacts",
    description: "Upload a CSV or add contacts manually.",
    icon: UsersIcon,
    status: "ready",
    href: "/dashboard/audience",
  },
  {
    id: "campaign",
    label: "Send first campaign",
    description: "Draft, preview, and send an email campaign.",
    icon: MailPlusIcon,
    status: "ready",
    href: "/dashboard/campaigns",
  },
  {
    id: "reputation",
    label: "Review send reputation",
    description: "Track bounce & complaint rates in analytics.",
    icon: ShieldCheckIcon,
    status: "soon",
  },
  {
    id: "invite",
    label: "Invite a teammate",
    description: "Collaborate with your team in one workspace.",
    icon: CircleDotIcon,
    status: "soon",
  },
];

type WorkspaceSetupCardProps = {
  completedSteps?: string[]; // array of step IDs that are done
};

export function WorkspaceSetupCard({
  completedSteps = ["org"],
}: WorkspaceSetupCardProps) {
  const doneCount = SETUP_STEPS.filter(
    (s) => s.status === "done" || completedSteps.includes(s.id),
  ).length;
  const progressPercent = Math.round((doneCount / SETUP_STEPS.length) * 100);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-medium">Workspace setup</CardTitle>
          <span className="text-xs tabular-nums text-muted-foreground">
            {doneCount}/{SETUP_STEPS.length}
          </span>
        </div>
        <div className="mt-2 space-y-1">
          <Progress value={progressPercent} className="h-1.5" />
          <p className="text-xs text-muted-foreground">
            {progressPercent}% complete
          </p>
        </div>
      </CardHeader>

      <CardContent className="flex-1 px-4 pb-4">
        <div className="space-y-1">
          {SETUP_STEPS.map((step) => {
            const StepIcon = step.icon;
            const isDone =
              step.status === "done" || completedSteps.includes(step.id);
            const effectiveStatus: SetupStep["status"] = isDone
              ? "done"
              : step.status;
            const config = statusConfig[effectiveStatus];

            const inner = (
              <div
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors",
                  step.href && !isDone
                    ? "cursor-pointer hover:bg-muted/60"
                    : "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md bg-muted",
                    isDone && "bg-emerald-500/10",
                  )}
                >
                  <StepIcon
                    className={cn("size-3.5", config.iconClass)}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-medium leading-none",
                      isDone && "text-muted-foreground line-through decoration-muted-foreground/40",
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {step.description}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn("shrink-0 text-xs", config.badgeClass)}
                >
                  {config.label}
                </Badge>
                {step.href && !isDone && (
                  <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                )}
              </div>
            );

            return step.href && !isDone ? (
              <a key={step.id} href={step.href}>
                {inner}
              </a>
            ) : (
              <div key={step.id}>{inner}</div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

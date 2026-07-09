"use client";

// Onboarding checklist for the overview: a left column of ordered setup steps
// and a right detail pane for the selected step. Step completion is derived
// from real workspace data (audience/templates/domains/campaigns), so nothing
// here is persisted — the card simply hides itself once every step is done.

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type OnboardingStep = {
  id: string;
  /** Checklist label. */
  title: string;
  done: boolean;
  /** Rough time estimate, shown on incomplete steps. */
  time?: string;
  /** Detail-pane title. */
  heading: string;
  /** Detail-pane body. */
  description: string;
  /** Where the CTA points. */
  href: string;
  /** CTA label. */
  cta: string;
  icon: LucideIcon;
};

export function GettingStarted({
  userName,
  steps,
}: {
  userName: string;
  steps: OnboardingStep[];
}) {
  const total = steps.length;
  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / total) * 100);

  // Open the detail pane on the first unfinished step by default.
  const firstTodo = steps.findIndex((s) => !s.done);
  const [selected, setSelected] = useState(firstTodo === -1 ? 0 : firstTodo);

  // Fully onboarded — nothing left to guide, so take up no space.
  if (doneCount === total) return null;

  const active = steps[selected];

  return (
    <Card className="gap-0 overflow-hidden p-0">
      {/* Headline + progress */}
      <div className="border-b border-border px-5 py-4">
        <p className="text-sm font-semibold text-primary">
          {userName}, you&apos;re {pct}% of the way to your first campaign
        </p>
        <div className="mt-2.5 flex items-center gap-3">
          <Progress value={pct} className="h-2 max-w-md" />
          <span className="shrink-0 text-xs text-muted-foreground">
            {doneCount}/{total} complete
          </span>
        </div>
      </div>

      {/* Checklist + detail */}
      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <ul className="flex flex-col gap-1 border-b border-border p-3 md:border-b-0 md:border-r">
          {steps.map((step, i) => {
            const isActive = i === selected;
            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => setSelected(i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                    isActive ? "bg-muted" : "hover:bg-muted/50",
                  )}
                >
                  <StepMarker done={step.done} active={isActive} />
                  <span
                    className={cn(
                      "flex-1 truncate text-sm",
                      step.done ? "text-muted-foreground" : "font-medium",
                    )}
                  >
                    {step.title}
                  </span>
                  {!step.done && step.time ? (
                    <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {step.time}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-base font-semibold">{active.heading}</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {active.description}
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link href={active.href}>{active.cta}</Link>
            </Button>
          </div>
          <span className="hidden size-16 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground sm:flex">
            <active.icon className="size-7" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Card>
  );
}

// Left-column status bullet: a filled check when done, a primary ring for the
// selected step, and a plain ring for steps still ahead.
function StepMarker({ done, active }: { done: boolean; active: boolean }) {
  if (done) {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <CheckIcon className="size-3" />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full border",
        active ? "border-primary" : "border-muted-foreground/40",
      )}
    >
      {active ? <span className="size-1.5 rounded-full bg-primary" /> : null}
    </span>
  );
}

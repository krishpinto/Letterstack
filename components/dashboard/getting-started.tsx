"use client";

// Onboarding guide for the overview. A required core path (add audience → design
// an email → send a campaign) drives the progress bar, plus an optional "Explore
// LetterStack" group that points new users at the rest of the app (domains,
// forms, automations, analytics). Completion is derived from live workspace data
// — nothing here is persisted except the user's choice to dismiss it.

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRightIcon, CheckIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type OnboardingStep = {
  id: string;
  /** Checklist label. */
  title: string;
  done: boolean;
  /** Optional steps guide exploration but don't count toward progress. */
  optional?: boolean;
  /** Rough time estimate, shown on incomplete required steps. */
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

const DISMISS_KEY = "letterstack:getting-started-dismissed";

export function GettingStarted({
  userName,
  steps,
}: {
  userName: string;
  steps: OnboardingStep[];
}) {
  const [dismissed, setDismissed] = useState<boolean>(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem(DISMISS_KEY) === "1",
  );

  // Default the detail pane to the first unfinished step (required ones sort
  // first in the array, so this naturally lands on the next thing to do).
  const firstTodo = steps.findIndex((s) => !s.done);
  const [selected, setSelected] = useState(firstTodo === -1 ? 0 : firstTodo);

  const required = steps.filter((s) => !s.optional);
  const optional = steps.filter((s) => s.optional);
  const requiredDone = required.filter((s) => s.done).length;
  const pct = required.length
    ? Math.round((requiredDone / required.length) * 100)
    : 100;
  const allRequiredDone = requiredDone === required.length;

  if (dismissed) return null;
  // Everything (including exploration) done — no reason to take up space.
  if (steps.every((s) => s.done)) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Storage unavailable — just hide it for this session.
    }
    setDismissed(true);
  }

  const active = steps[selected];

  return (
    <Card className="gap-0 overflow-hidden p-0">
      {/* Header + progress */}
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary">
            {allRequiredDone
              ? `Nice work, ${userName} — you're set up to send 🎉`
              : `${userName}, you're ${pct}% of the way to your first campaign`}
          </p>
          <div className="mt-2.5 flex items-center gap-3">
            <Progress value={pct} className="h-2 max-w-md" />
            <span className="shrink-0 text-xs text-muted-foreground">
              {requiredDone}/{required.length} done
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {allRequiredDone
              ? "Explore the rest of LetterStack below, or hide this guide."
              : "A quick tour to get your first newsletter out the door."}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={dismiss}
          aria-label="Hide getting started"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <XIcon className="size-4" />
        </Button>
      </div>

      {/* Checklist + detail */}
      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="flex flex-col gap-1 border-b border-border p-3 md:border-b-0 md:border-r">
          {steps.map((step, index) =>
            step.optional ? null : (
              <StepRow
                key={step.id}
                step={step}
                active={index === selected}
                onSelect={() => setSelected(index)}
              />
            ),
          )}

          {optional.length > 0 && (
            <>
              <p className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground/60 uppercase">
                Explore LetterStack
              </p>
              {steps.map((step, index) =>
                step.optional ? (
                  <StepRow
                    key={step.id}
                    step={step}
                    active={index === selected}
                    onSelect={() => setSelected(index)}
                  />
                ) : null,
              )}
            </>
          )}
        </div>

        {/* Detail pane for the selected step */}
        <div className="flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-base font-semibold">{active.heading}</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {active.description}
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link href={active.href}>
                {active.done ? "Revisit" : active.cta}
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
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

function StepRow({
  step,
  active,
  onSelect,
}: {
  step: OnboardingStep;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
        active ? "bg-muted" : "hover:bg-muted/50",
      )}
    >
      <StepMarker done={step.done} active={active} />
      <span
        className={cn(
          "flex-1 truncate text-sm",
          step.done ? "text-muted-foreground" : "font-medium",
        )}
      >
        {step.title}
      </span>
      {!step.done && step.optional ? (
        <span className="shrink-0 text-[11px] text-muted-foreground/70">
          Optional
        </span>
      ) : !step.done && step.time ? (
        <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {step.time}
        </span>
      ) : null}
    </button>
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

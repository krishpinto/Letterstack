"use client";

import { useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRightIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type OnboardingStep = {
  id: string;
  title: string;
  done: boolean;
  optional?: boolean;
  time?: string;
  heading: string;
  description: string;
  href: string;
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

  const [expanded, setExpanded] = useState<boolean>(true);

  // Default the detail pane to the first unfinished step
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
  // Everything done — hide to save space
  if (steps.every((s) => s.done)) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Storage unavailable
    }
    setDismissed(true);
  }

  const active = steps[selected];

  return (
    /* ── Outer Chrome Container (bg-muted p-1) matching StatFrameCard ── */
    <div className="overflow-hidden rounded-[1.375rem] border border-border bg-muted p-1 pb-0 gap-0 select-none flex flex-col">
      
      {/* ── Inner Main Card (bg-card) ── */}
      <div className="rounded-[1.125rem] border border-border bg-card p-4 flex flex-col gap-5">
        
        {/* Header Row (Progress + Dismiss) */}
        <div
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between gap-3 px-1.5 py-1 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Circular Progress SVG */}
            <div className="relative size-6 shrink-0 flex items-center justify-center">
              <svg className="size-6 shrink-0 -rotate-90 absolute" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9.5" stroke="currentColor" className="text-muted/40" strokeWidth="2" fill="none" />
                <circle cx="12" cy="12" r="9.5" stroke="currentColor" className="text-primary" strokeWidth="2.2" fill="none" strokeDasharray={59.7} strokeDashoffset={59.7 - (59.7 * pct) / 100} strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-base font-bold text-foreground truncate">
              Get Started
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-xs text-muted-foreground font-medium">
              {requiredDone} of {required.length} Completed
            </span>
            <svg
              className={cn("size-4 text-muted-foreground/60 transition-transform duration-200", !expanded && "rotate-180")}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground/60 p-0 h-6 w-6 hover:bg-muted/30"
              onClick={(e) => {
                e.stopPropagation();
                dismiss();
              }}
              aria-label="Dismiss guide"
            >
              <XIcon className="size-4" />
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="grid gap-6 md:grid-cols-[1.15fr_1fr] items-stretch">
            {/* Left Column: Checklist Pane */}
            <div className="flex flex-col gap-0.5">
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
                  <p className="px-3.5 pt-3.5 pb-1 text-[10px] font-bold tracking-wider text-muted-foreground/40 uppercase">
                    Explore Letterstack
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

            {/* Right Column: Refined Detail panel */}
            <div className="rounded-[18px] bg-muted/20 border border-border/40 p-4 flex flex-col justify-between overflow-hidden">
              {/* Mockup box */}
              <div className="w-full flex-1 flex flex-col items-center justify-center p-2 mb-3 bg-background rounded-xl border border-border/50 min-h-[140px] shadow-2xs">
                <StepMockup id={active.id} />
              </div>

              {/* Step text */}
              <div className="mb-4">
                <h3 className="text-base font-bold tracking-tight text-foreground">{active.heading}</h3>
                <p className="mt-1 text-[13px] text-muted-foreground/95 leading-relaxed">
                  {active.description}
                </p>
              </div>

              {/* Action button */}
              <div className="border-t border-border/40 pt-3 mt-auto">
                <Button asChild size="sm" className="w-fit px-5 shadow-xs">
                  <Link href={active.href}>
                    {active.done ? "Revisit Step" : active.cta}
                    <ArrowRightIcon className="size-3.5" data-icon="inline-end" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom Strip (Status Message in the bg-muted frame) ── */}
      <div className="flex items-center justify-center py-2.5 text-xs font-semibold text-muted-foreground/80">
        {allRequiredDone 
          ? "Nice work! All core steps completed." 
          : "Nice start, keep going"}
      </div>
    </div>
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
        "flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-left transition-all duration-200 group",
        active ? "bg-muted/70" : "hover:bg-muted/30",
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <StepMarker done={step.done} />
        <span
          className={cn(
            "truncate text-[13px] sm:text-sm transition-all",
            step.done 
              ? "line-through text-muted-foreground/40 font-normal" 
              : "text-foreground font-medium"
          )}
        >
          {step.title}
        </span>
      </div>
      
      <div className="flex items-center gap-2.5 shrink-0">
        {!step.done && step.optional ? (
          <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-wider">
            Optional
          </span>
        ) : !step.done && step.time ? (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground/80 font-mono font-medium">
            {step.time}
          </span>
        ) : null}
        
        <svg 
          className={cn(
            "size-3.5 transition-all duration-200", 
            active 
              ? "text-foreground translate-x-0.5" 
              : "text-muted-foreground/25 group-hover:text-muted-foreground/75 group-hover:translate-x-0.5"
          )}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor" 
          strokeWidth="2.5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

function StepMarker({ done }: { done: boolean }) {
  if (done) {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
        <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-background shadow-xs group-hover:border-muted-foreground/30 transition-colors" />
  );
}

function StepMockup({ id }: { id: string }) {
  switch (id) {
    case "account":
      return (
        <div className="w-full rounded-xl border border-border bg-background p-3 shadow-xs font-sans text-xs">
          {/* Top Header Mock */}
          <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="size-4.5 rounded bg-primary text-primary-foreground flex items-center justify-center font-bold text-[9px]">W</div>
              <span className="font-semibold text-foreground">Workspace Settings</span>
            </div>
            <span className="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground font-medium">Free Tier</span>
          </div>
          {/* Form details mock */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <div className="h-1.5 w-12 bg-muted-foreground/30 rounded" />
              <div className="h-7 w-full border border-border rounded bg-muted/10 px-2 flex items-center text-muted-foreground text-[11px]">Letterstack Team</div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="h-1.5 w-24 bg-muted-foreground/30 rounded" />
              <div className="h-7 w-full border border-border rounded bg-muted/10 px-2 flex items-center text-muted-foreground text-[11px]">support@letterstack.com</div>
            </div>
          </div>
        </div>
      );
    case "audience":
      return (
        <div className="w-full rounded-xl border border-border bg-background p-3 shadow-xs font-sans text-[11px]">
          {/* Mini Table header */}
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-foreground">Subscribers</span>
            <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">Import CSV</span>
          </div>
          {/* Rows */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
              <span className="font-medium text-foreground truncate max-w-[120px]">Lucia Garza</span>
              <span className="text-emerald-500 font-medium">Active</span>
            </div>
            <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
              <span className="font-medium text-foreground truncate max-w-[120px]">Judah Montes</span>
              <span className="text-emerald-500 font-medium">Active</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground truncate max-w-[120px]">Roselyn McCoy</span>
              <span className="text-muted-foreground">Pending</span>
            </div>
          </div>
        </div>
      );
    case "template":
      return (
        <div className="w-full rounded-xl border border-border bg-background p-3 shadow-xs font-sans text-xs">
          {/* Email Newsletter mockup */}
          <div className="border border-border/60 rounded bg-muted/10 p-2 flex flex-col gap-2">
            {/* Logo */}
            <div className="flex justify-center border-b border-border/40 pb-2">
              <div className="h-4 w-16 bg-primary/20 rounded flex items-center justify-center text-[8px] font-bold text-primary">LETTERSTACK</div>
            </div>
            {/* Hero image placeholder */}
            <div className="h-10 w-full bg-muted rounded flex items-center justify-center text-[9px] text-muted-foreground font-medium">Hero Image</div>
            {/* Header text */}
            <div className="flex flex-col gap-1">
              <div className="h-2 w-3/4 bg-foreground/80 rounded" />
              <div className="h-1.5 w-1/2 bg-muted-foreground/60 rounded" />
            </div>
            {/* CTA Button */}
            <div className="flex justify-center">
              <div className="h-5 w-24 bg-primary rounded flex items-center justify-center text-[9px] text-primary-foreground font-semibold">Click Here</div>
            </div>
          </div>
        </div>
      );
    case "campaign":
      return (
        <div className="w-full rounded-xl border border-border bg-background p-3 shadow-xs font-sans text-[11px]">
          {/* Campaign details mockup */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <span className="text-muted-foreground">To:</span>
              <span className="font-medium text-foreground">Newsletter List (3,402)</span>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <span className="text-muted-foreground">Subject:</span>
              <span className="font-medium text-foreground truncate max-w-[140px]">July Product Updates</span>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <span className="text-muted-foreground">Schedule:</span>
              <span className="font-medium text-foreground">Send immediately</span>
            </div>
            <button className="w-full h-7 bg-primary text-primary-foreground font-semibold rounded text-xs hover:bg-primary/95 transition-colors mt-1 flex items-center justify-center gap-1.5 shadow-sm">
              Launch Campaign
            </button>
          </div>
        </div>
      );
    case "domain":
      return (
        <div className="w-full rounded-xl border border-border bg-background p-3 shadow-xs font-sans text-[10px]">
          {/* DNS Mock table */}
          <div className="grid grid-cols-3 gap-1 border-b border-border pb-1 mb-1.5 font-bold text-foreground">
            <span>Type</span>
            <span>Name</span>
            <span className="text-right">Status</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="grid grid-cols-3 gap-1 border-b border-border/40 pb-1.5">
              <span className="text-muted-foreground">CNAME</span>
              <span className="truncate text-foreground font-medium">mail</span>
              <span className="text-emerald-500 font-semibold text-right">Verified</span>
            </div>
            <div className="grid grid-cols-3 gap-1 border-b border-border/40 pb-1.5">
              <span className="text-muted-foreground">TXT</span>
              <span className="truncate text-foreground font-medium">ls-verify</span>
              <span className="text-emerald-500 font-semibold text-right">Verified</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className="text-muted-foreground">MX</span>
              <span className="truncate text-foreground font-medium">@</span>
              <span className="text-emerald-500 font-semibold text-right">Verified</span>
            </div>
          </div>
        </div>
      );
    case "forms":
      return (
        <div className="w-full rounded-xl border border-border bg-background p-3.5 shadow-xs font-sans text-xs">
          {/* Embed signup form */}
          <div className="border border-border rounded p-2.5 bg-muted/10 flex flex-col gap-2">
            <span className="font-semibold text-foreground text-center">Subscribe</span>
            <div className="flex flex-col gap-1">
              <input disabled placeholder="name@domain.com" className="h-7 w-full border border-border rounded bg-background px-2 text-[10px] select-none" />
            </div>
            <button className="h-7 w-full bg-foreground text-background font-semibold rounded text-[10px]">Join Newsletter</button>
          </div>
        </div>
      );
    case "automations":
      return (
        <div className="w-full rounded-xl border border-border bg-background p-3 shadow-xs font-sans text-xs">
          {/* Automation flow map */}
          <div className="flex flex-col gap-2.5 items-center">
            <div className="w-full border border-border rounded bg-muted/20 px-2 py-1.5 flex items-center justify-between gap-1.5">
              <span className="font-semibold text-foreground">Subscriber Joins</span>
              <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase">Trigger</span>
            </div>
            <div className="h-3 w-px bg-border relative">
              <div className="absolute -bottom-1 -left-[3px] border-l-[3px] border-r-[3px] border-t-[4px] border-transparent border-t-border" />
            </div>
            <div className="w-full border border-border rounded bg-primary/5 px-2 py-1.5 flex items-center justify-between gap-1.5">
              <span className="font-semibold text-primary">Send Welcome Email</span>
              <span className="text-[9px] bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded font-bold uppercase">Action</span>
            </div>
          </div>
        </div>
      );
    case "analytics":
      return (
        <div className="w-full rounded-xl border border-border bg-background p-3 shadow-xs font-sans text-[11px]">
          {/* Analytics Overview cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="border border-border rounded p-2 bg-muted/20">
              <span className="text-[10px] text-muted-foreground block">Deliveries</span>
              <span className="text-sm font-bold text-foreground block mt-0.5">99.8%</span>
            </div>
            <div className="border border-border rounded p-2 bg-muted/20">
              <span className="text-[10px] text-muted-foreground block">Open Rate</span>
              <span className="text-sm font-bold text-primary block mt-0.5">42.5%</span>
            </div>
            <div className="border border-border rounded p-2 bg-muted/20">
              <span className="text-[10px] text-muted-foreground block">Clicks</span>
              <span className="text-sm font-bold text-foreground block mt-0.5">12.1%</span>
            </div>
            <div className="border border-border rounded p-2 bg-muted/20">
              <span className="text-[10px] text-muted-foreground block">Bounces</span>
              <span className="text-sm font-bold text-destructive block mt-0.5">0.05%</span>
            </div>
          </div>
        </div>
      );
    default:
      return null;
  }
}

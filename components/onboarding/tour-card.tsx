"use client";

// The tour tooltip. Onborda renders this for every step and hands it the step
// plus its navigation callbacks; everything visual here is ours.
//
// Deliberately built from the same chrome as the dashboard's Getting Started
// card — muted outer frame at p-1, card-coloured inner panel, status strip
// along the bottom — so the tour reads as part of the product rather than as
// a third-party overlay dropped on top of it.

import { useLayoutEffect, useRef, useState } from "react";
import type { CardComponentProps } from "onborda";
import { useOnborda } from "onborda";
import { ArrowLeftIcon, ArrowRightIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Breathing room kept between the card and the edge of the window. */
const VIEWPORT_MARGIN = 12;
/** Give up waiting for the card's move to settle after this long. */
const SETTLE_TIMEOUT_MS = 1_200;

/**
 * Onborda positions the card purely relative to its target and never checks
 * the result against the viewport, so a target near an edge — the top of the
 * icon rail, say — pushes the card half off screen. Picking anchored sides
 * (`right-top`, `right-bottom`) avoids that in our layout; this is the
 * backstop for short windows, where even an anchored card can run past the
 * bottom. It nudges vertically only, so the arrow stays on its target
 * horizontally.
 */
function useKeepOnScreen(dependency: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [offsetY, setOffsetY] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const clamp = () => {
      // Measure without our own correction applied, so the fix is computed
      // from the position Onborda actually asked for.
      setOffsetY((current) => {
        const rect = element.getBoundingClientRect();
        const top = rect.top - current;
        const bottom = rect.bottom - current;

        if (top < VIEWPORT_MARGIN) return VIEWPORT_MARGIN - top;
        const limit = window.innerHeight - VIEWPORT_MARGIN;
        if (bottom > limit) {
          // Never push the top off screen to rescue the bottom.
          return Math.max(limit - bottom, VIEWPORT_MARGIN - top);
        }
        return 0;
      });
    };

    // Onborda's card container animates between steps (`transition-all`), and
    // it also scrolls a target into view before settling. A single measurement
    // therefore lands mid-flight and pins the wrong offset for the whole step.
    // Re-measure each frame until the box stops moving, then stop.
    let frame = 0;
    let settledFor = 0;
    let lastTop = Number.NaN;
    const deadline = performance.now() + SETTLE_TIMEOUT_MS;

    const tick = () => {
      const top = element.getBoundingClientRect().top;
      settledFor = Math.abs(top - lastTop) < 0.5 ? settledFor + 1 : 0;
      lastTop = top;
      clamp();

      // Two consecutive still frames is enough to call it landed.
      if (settledFor < 2 && performance.now() < deadline) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    window.addEventListener("resize", clamp);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", clamp);
    };
    // Re-measured on every step: each one has its own target and side.
  }, [dependency]);

  return { ref, offsetY };
}

export function TourCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  arrow,
}: CardComponentProps) {
  const { closeOnborda } = useOnborda();
  const { ref, offsetY } = useKeepOnScreen(currentStep);

  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;

  return (
    <div
      ref={ref}
      className="w-[320px] max-w-[calc(100vw-2rem)]"
      style={offsetY ? { transform: `translateY(${offsetY}px)` } : undefined}
    >
      <div className="flex flex-col overflow-hidden rounded-[1.375rem] border border-border bg-muted p-1 pb-0 shadow-xl select-none">
        {/* ── Inner panel ── */}
        <div className="flex flex-col gap-3 rounded-[1.125rem] border border-border bg-card p-4">
          {/* Header: icon + title + dismiss */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              {step.icon ? (
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {step.icon}
                </span>
              ) : null}
              <h3 className="truncate text-sm font-bold tracking-tight text-foreground">
                {step.title}
              </h3>
            </div>

            <Button
              variant="ghost"
              size="icon-sm"
              className="h-6 w-6 shrink-0 p-0 text-muted-foreground/60 hover:bg-muted/30"
              onClick={() => closeOnborda()}
              aria-label="Skip tour"
            >
              <XIcon className="size-4" />
            </Button>
          </div>

          {/* Body */}
          <div className="text-[13px] leading-relaxed text-muted-foreground/95">
            {step.content}
          </div>

          {/* Controls */}
          <div className="mt-1 flex items-center justify-between gap-3 border-t border-border/40 pt-3">
            {/* Progress dots — the whole rail is one journey, so showing how
                much is left matters more than a bare step number. */}
            <div className="flex items-center gap-1" aria-hidden>
              {Array.from({ length: totalSteps }).map((_, index) => (
                <span
                  key={index}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-200",
                    index === currentStep
                      ? "w-4 bg-primary"
                      : index < currentStep
                        ? "w-1.5 bg-primary/40"
                        : "w-1.5 bg-muted-foreground/20",
                  )}
                />
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              {!isFirst && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => prevStep()}
                >
                  <ArrowLeftIcon className="size-3.5" data-icon="inline-start" />
                  Back
                </Button>
              )}
              <Button
                size="sm"
                className="h-7 px-3 text-xs shadow-xs"
                onClick={() => (isLast ? closeOnborda() : nextStep())}
              >
                {isLast ? "Finish" : "Next"}
                {!isLast && (
                  <ArrowRightIcon className="size-3.5" data-icon="inline-end" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Bottom strip, inside the muted frame ── */}
        <div className="flex items-center justify-center py-2 text-[11px] font-semibold text-muted-foreground/80">
          Step {currentStep + 1} of {totalSteps}
        </div>
      </div>

      {/* Onborda's pointer, coloured to the card so the tail reads as part of
          the muted frame rather than a stray triangle. */}
      <span className="text-muted">{arrow}</span>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, MotionConfig, useInView, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

import { focusRing } from "../landing-ui";

// Shared parts for the feature demos (features-*.tsx). Each demo is a small
// illustration of one thing the product does, drawn straight onto its cell:
// no grey stage, at most one card deep. The parts here are the surface the
// drawings sit on, the controls people press, and the few motions every cell
// shares (a tick that draws itself, a number that counts).
//
// Motion rules for the whole section:
//   - One curve (EASE_OUT), 200–600ms, staggered where several things move.
//   - A visual may play a short entrance the first time it scrolls into view
//     (useEntered). Only lines and marks are drawn in; text and controls are
//     always there, so nothing is hidden if scripts are slow.
//   - A loop runs only while its cell is on screen (useOnScreen).
//   - Under prefers-reduced-motion nothing moves: useMotion().t() gives every
//     motion component a zero-length transition, FeaturesMotion switches off
//     CSS transitions and animations for everything inside the section, and
//     each cell shows its finished state.

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export const VIOLET = "#6C5ED1";
export const EMERALD = "#10b981";

/**
 * Wraps the section. MotionConfig drops transforms and layout animations for
 * people who ask for reduced motion; the wrapper's classes do the same for
 * CSS transitions and keyframes.
 */
export function FeaturesMotion({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="motion-reduce:**:transition-none! motion-reduce:**:animate-none!">
        {children}
      </div>
    </MotionConfig>
  );
}

/** Whether to animate, and the one transition every demo uses. */
export function useMotion() {
  const reduce = Boolean(useReducedMotion());
  return {
    reduce,
    t: (duration = 0.4, delay = 0) =>
      reduce ? { duration: 0 } : { duration, delay, ease: EASE_OUT },
  };
}

/** True from the first time the element is properly on screen. */
export function useEntered(ref: React.RefObject<Element | null>) {
  const reduce = useReducedMotion();
  const seen = useInView(ref, { once: true, amount: 0.4 });
  return seen || Boolean(reduce);
}

/** True while any part of the element is on screen. For pausing loops. */
export function useOnScreen(ref: React.RefObject<Element | null>) {
  return useInView(ref, { amount: 0.15 });
}

/** The width of an element in CSS pixels, 0 until it has been measured. */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * The area a cell's illustration is drawn in. It cancels the cell's padding
 * so the drawing reaches the cell's edges, has a fixed height so using a demo
 * never moves the page, and is a size container, so a drawing can adapt to
 * the width of its cell (`@md:` and friends) rather than the window.
 */
export function Visual({
  ref,
  backdrop = "none",
  bleed = true,
  className,
  innerClassName,
  children,
}: {
  ref?: React.Ref<HTMLDivElement>;
  /** `dots` draws a dot grid that fades out towards the edges. */
  backdrop?: "none" | "dots";
  /** Set to false when the parent is not a padded `Cell`. */
  bleed?: boolean;
  className?: string;
  innerClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={ref}
      className={cn(
        "@container relative overflow-hidden",
        bleed && "-mx-6 -mt-6 sm:-mx-8 sm:-mt-8",
        className,
      )}
    >
      {backdrop === "dots" && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,#d9d9d9_1px,transparent_1.2px)] bg-[length:16px_16px] [mask-image:radial-gradient(ellipse_75%_75%_at_50%_45%,black_25%,transparent_100%)]"
        />
      )}
      <div className={cn("relative flex h-full flex-col px-6 pt-6 sm:px-8 sm:pt-8", innerClassName)}>
        {children}
      </div>
    </div>
  );
}

/** Hairline plus three soft shadows: the one card surface in the section. */
export const cardSurface =
  "border border-neutral-200 bg-white shadow-[0_1px_1px_rgba(0,0,0,0.02),0_3px_6px_-2px_rgba(0,0,0,0.04),0_16px_28px_-16px_rgba(0,0,0,0.10)]";
/** The same idea for small things: chips, nodes, rows. */
export const chipSurface =
  "border border-neutral-200 bg-white shadow-[0_1px_1px_rgba(0,0,0,0.03),0_2px_4px_-2px_rgba(0,0,0,0.05)]";

export function Panel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("w-full rounded-xl text-[13px] text-neutral-700", cardSurface, className)}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * A round mark that fills and draws its tick when `on` turns true. Decorative:
 * say the state in text next to it.
 */
export function Tick({
  on,
  size = 16,
  color = EMERALD,
  delay = 0,
  bare = false,
  className,
}: {
  on: boolean;
  size?: number;
  color?: string;
  delay?: number;
  /** Leave out the empty ring, so nothing shows until `on`. */
  bare?: boolean;
  className?: string;
}) {
  const { t } = useMotion();
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden
      className={cn("shrink-0", className)}
    >
      {!bare && <circle cx="8" cy="8" r="7.25" fill="white" stroke="#d4d4d4" strokeWidth="1.5" />}
      <motion.circle
        cx="8"
        cy="8"
        r="8"
        fill={color}
        initial={false}
        animate={{ scale: on ? 1 : 0.4, opacity: on ? 1 : 0 }}
        transition={t(0.3, on ? delay : 0)}
      />
      <motion.path
        d="M4.9 8.3 7.1 10.5 11.2 5.9"
        fill="none"
        stroke="white"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={false}
        animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
        transition={t(0.3, on ? delay + 0.08 : 0)}
      />
    </svg>
  );
}

/**
 * The action button used inside the demos: the page's button (black primary,
 * 8px radius) one size down. 36px tall on phones, 32px from `sm` up.
 */
export function DemoButton({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium whitespace-nowrap sm:h-8",
        "transition-[background-color,border-color,color,transform] duration-150 ease-out",
        "active:scale-[0.97]",
        "aria-disabled:cursor-default aria-disabled:opacity-60 aria-disabled:active:scale-100",
        variant === "primary"
          ? "bg-neutral-950 text-white hover:bg-neutral-800"
          : "border border-neutral-200 bg-white text-neutral-950 hover:bg-neutral-50",
        focusRing,
        className,
      )}
      {...props}
    />
  );
}

const PILL_TONES = {
  neutral: "bg-neutral-100 text-neutral-600",
  success: "bg-emerald-50 text-emerald-700",
  accent: "bg-[#6C5ED1]/10 text-[#5546c4]",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
} as const;

export function StatusPill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: keyof typeof PILL_TONES;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors duration-200",
        PILL_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const formatNumber = (value: number) => value.toLocaleString("en-GB");

/**
 * A number that counts to its new value when it changes. React renders the
 * first value once and never touches the text again; the effect owns it from
 * then on, so there is no frame where the final value flashes before the
 * count starts. Screen readers get the plain value from a hidden twin.
 */
export function CountUp({
  value,
  duration = 0.45,
  linear = false,
  className,
}: {
  value: number;
  duration?: number;
  /** Count at a steady rate, to keep step with something else that does. */
  linear?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [initial] = useState(value);
  const node = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);

  useEffect(() => {
    const el = node.current;
    if (!el) return;
    if (reduce || shown.current === value) {
      shown.current = value;
      el.textContent = formatNumber(value);
      return;
    }
    const controls = animate(shown.current, value, {
      duration,
      ease: linear ? "linear" : EASE_OUT,
      onUpdate: (latest) => {
        shown.current = Math.round(latest);
        el.textContent = formatNumber(shown.current);
      },
    });
    return () => controls.stop();
  }, [value, duration, linear, reduce]);

  return (
    <span className={cn("tabular-nums", className)}>
      <span ref={node} aria-hidden>
        {formatNumber(initial)}
      </span>
      <span className="sr-only">{formatNumber(value)}</span>
    </span>
  );
}

/**
 * A set of options where exactly one is chosen: a radio group with one tab
 * stop. Arrow keys move the choice, as in the WAI-ARIA radio pattern, so a
 * keyboard user passes each demo in one Tab press instead of one per option.
 */
export function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
  itemClassName,
}: {
  label: string;
  options: { value: T; label: React.ReactNode; name?: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  itemClassName?: (selected: boolean) => string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (from: number, delta: number) => {
    const next = (from + delta + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className={className}>
      {options.map((option, i) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.name}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(i, 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(i, -1);
              }
            }}
            className={cn(focusRing, itemClassName?.(selected))}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Styles for a ChoiceGroup drawn as a segmented control. */
export const segmented = {
  group: "inline-flex rounded-lg bg-neutral-100 p-0.5 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]",
  item: (selected: boolean) =>
    cn(
      "h-9 rounded-md px-3 text-xs font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-150 sm:h-7",
      selected
        ? "bg-white text-neutral-950 shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.08)]"
        : "text-neutral-600 hover:text-neutral-950",
    ),
};

/** Styles for a ChoiceGroup drawn as a row of small chips. */
export const chips = {
  item: (selected: boolean) =>
    cn(
      "h-9 rounded-lg border text-xs tabular-nums transition-[background-color,border-color,color,box-shadow] duration-150 sm:h-7",
      selected
        ? "border-[#6C5ED1] bg-[#6C5ED1]/[0.07] font-medium text-[#4f41b8] shadow-[0_0_0_3px_rgba(108,94,209,0.10)]"
        : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-950",
    ),
};

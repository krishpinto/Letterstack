import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// Shared building blocks for every landing section. Sections compose these
// instead of inventing their own headings, spacing or card styles; that
// sameness is what makes the page feel like one designed thing.
//
// The system, in one place:
//   Grid      every section is a <Frame> (frame.tsx): 1200px column, hairline
//             rails, full-width hairline under each section.
//   Type      display = Bricolage Grotesque (var(--font-bricolage)), semibold,
//             tight tracking. Body = Inter. Neutral greys for text.
//   Colour    neutral-950 text, neutral-500 secondary, neutral-200 hairlines,
//             one accent: brand violet #6C5ED1. Emerald only for "success".
//   Spacing   section intro: pt-20/sm:pt-28; cells: p-6/sm:p-8.
//   Buttons   one shape (see `button` below); black is the primary action.
//   Focus     one ring (see `focusRing` below) on every link and control.
//   Visuals   product UI drawn in HTML/SVG sits straight on the cell, with
//             no extra box around it.
//   Motion    calm. Ambient motion is slow and small, runs only while on
//             screen, and never starts under prefers-reduced-motion.

export const displayFont = { fontFamily: "var(--font-bricolage, var(--font-inter))" };

/** The one keyboard-focus treatment for the whole page: a 2px violet outline. */
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6c5ed1]";
/** The same outline in white, for controls that sit on the dusk scene. */
export const focusRingOnDark =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

// The one button system: 40px tall, 8px radius, 14px medium. (The navbar uses
// the same shape at 32px.) Black is the primary action everywhere; violet is
// reserved for accents inside product UI.
const buttonShape =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-5 text-sm font-medium whitespace-nowrap transition-colors";
export const button = {
  primary: `${buttonShape} ${focusRing} bg-neutral-950 text-white hover:bg-neutral-800`,
  secondary: `${buttonShape} ${focusRing} border border-neutral-200 bg-white text-neutral-950 hover:bg-neutral-50`,
  onDarkPrimary: `${buttonShape} ${focusRingOnDark} bg-white text-neutral-950 hover:bg-neutral-100`,
  onDarkSecondary: `${buttonShape} ${focusRingOnDark} border border-white/30 bg-neutral-950/40 text-white backdrop-blur-sm hover:bg-neutral-950/55 hover:text-white`,
} as const;

/** Centered eyebrow + heading + description at the top of a section. */
export function SectionIntro({
  icon: Icon,
  eyebrow,
  title,
  description,
  className,
}: {
  icon?: LucideIcon;
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-2xl flex-col items-center px-6 pb-12 pt-20 text-center sm:pb-16 sm:pt-28",
        className,
      )}
    >
      {eyebrow && (
        <p className="flex items-center gap-2 text-sm font-medium text-neutral-500">
          {Icon && <Icon className="size-4" aria-hidden />}
          {eyebrow}
        </p>
      )}
      <h2
        className="mt-4 text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-neutral-950 sm:text-5xl"
        style={displayFont}
      >
        {title}
      </h2>
      {description && (
        <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-neutral-500 sm:text-lg">
          {description}
        </p>
      )}
    </div>
  );
}

/**
 * A grid of cells divided by hairlines, Dub-style. The 1px gap shows the
 * grid's grey background through, so every divider is exactly one hairline
 * no matter how many columns or rows there are. Sits flush against the
 * frame's rails, so it needs no outer border except the top one.
 */
export function CellGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    // grid-cols-1 (= minmax(0, 1fr)): without it the single phone column
    // grows to fit its widest child and the page scrolls sideways at 320px.
    <div
      className={cn(
        "grid grid-cols-1 gap-px border-t border-neutral-200 bg-neutral-200",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** One cell: a visual on top, then a short title and one or two lines. */
export function Cell({
  title,
  description,
  visual,
  className,
}: {
  title: string;
  description: React.ReactNode;
  visual?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col bg-white p-6 sm:p-8", className)}>
      {visual && <div className="mb-6 sm:mb-8">{visual}</div>}
      <h3 className="text-base font-semibold text-neutral-950">{title}</h3>
      <p className="mt-1.5 text-pretty text-sm leading-relaxed text-neutral-500 sm:text-[15px]">
        {description}
      </p>
    </div>
  );
}

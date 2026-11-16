"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { PauseIcon, PlayIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { Frame } from "./frame";
import { focusRing } from "./landing-ui";

// The product, shown plainly: one large framed screen with a row of tabs
// under it.
//
// It tours itself: every few seconds it moves to the next tab, and a thin
// line on the active tab shows how long is left. The tour is polite about it:
//   - it only runs while the box is on screen,
//   - it pauses while the pointer or keyboard focus is inside the section,
//   - it stops for good once someone picks a tab, and there is a pause button,
//   - it never starts for people who ask their system for reduced motion.
//
// The timer IS the progress line's CSS animation: when the animation ends,
// React advances the tab. Pausing the tour is `animation-play-state: paused`,
// so the line and the timer can never drift apart, and there is no interval
// to clean up.
//
// Every screen is rendered and stacked, and only the active one is opaque.
// That makes switching instant (no image to fetch at switch time) and lets
// the change be a plain CSS crossfade.
//
// Tabs follow the WAI-ARIA tabs pattern: arrow keys move between them, Home
// and End jump to the ends, and only the active tab is in the tab order.

const TOUR_SECONDS = 6;

type Screen = { key: string; label: string; src: string; alt: string; caption: string };

const SCREENS: Screen[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    src: "/product/app-dashboard.webp",
    alt: "LetterStack dashboard: emails delivered, open rate, audience size and recent campaigns",
    caption: "Deliveries, opens and your latest campaigns, the moment you sign in.",
  },
  {
    key: "editor",
    label: "Editor",
    src: "/product/app-editor.webp",
    alt: "The block email editor with a members newsletter open",
    caption: "The block editor, with a members newsletter open.",
  },
  {
    key: "report",
    label: "Report",
    src: "/product/app-report.webp",
    alt: "A campaign report showing delivery, open and click rates",
    caption: "One campaign's report: delivered, opened, clicked and bounced.",
  },
  {
    key: "audience",
    label: "Audience",
    src: "/product/app-audience.webp",
    alt: "Audience page with contacts sorted into folders",
    caption: "Your contacts, sorted into folders you can send to.",
  },
  {
    key: "forms",
    label: "Forms",
    src: "/product/app-forms.webp",
    alt: "Signup forms page with several embeddable forms",
    caption: "Signup forms for your site: in the page, as a popup or as a slide-in.",
  },
];

export function ProductPreview() {
  const [active, setActive] = useState(0);
  // The tour runs until someone takes over (picks a tab or presses pause).
  const [touring, setTouring] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();

  // Run the tour only while most of the box is actually visible.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), {
      threshold: 0.5,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // On phones the tabs are a horizontal strip; keep the active one in view.
  // Scrolls the strip itself, never the page.
  useEffect(() => {
    const list = listRef.current;
    const tab = tabRefs.current[active];
    if (!list || !tab || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({
      left: tab.offsetLeft - (list.clientWidth - tab.offsetWidth) / 2,
      behavior: "smooth",
    });
  }, [active]);

  /** A person chose this tab: show it, optionally focus it, end the tour. */
  const choose = (index: number, focus = false) => {
    const next = (index + SCREENS.length) % SCREENS.length;
    setTouring(false);
    setActive(next);
    if (focus) tabRefs.current[next]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const moves: Record<string, number> = {
      ArrowRight: active + 1,
      ArrowLeft: active - 1,
      Home: 0,
      End: SCREENS.length - 1,
    };
    if (e.key in moves) {
      e.preventDefault();
      choose(moves[e.key], true);
    }
  };

  const running = touring && onScreen && !hovered;

  return (
    <Frame id="product" className="relative" innerClassName="px-3 pb-10 sm:px-4 sm:pb-12">
      {/* Only the box is pulled up, over the foot of the hero's hills, so the
          product sits in the scene. The frame itself (and its side rails)
          still starts at the hero's bottom edge. */}
      <h2 className="sr-only">Product tour</h2>
      <div
        ref={sectionRef}
        className="-mt-14 sm:-mt-24"
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setHovered(false);
        }}
      >
        {/* The box */}
        <div className="rounded-[22px] border border-neutral-200 bg-neutral-50 p-2 sm:p-3">
          <div
            role="tabpanel"
            id={`${id}-panel`}
            aria-labelledby={`${id}-tab-${active}`}
            className="relative aspect-[4/3] overflow-hidden rounded-[14px] bg-white sm:aspect-[16/10] shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_32px_-12px_rgba(20,10,60,0.25)] ring-1 ring-black/10"
          >
            {SCREENS.map((screen, i) => (
              <Image
                key={screen.key}
                src={screen.src}
                alt={i === active ? screen.alt : ""}
                aria-hidden={i !== active}
                fill
                sizes="(min-width: 1200px) 1140px, 100vw"
                // On phones the whole screen would be a thumbnail too small
                // to read, so show its top-left corner enlarged instead.
                className={cn(
                  "origin-top-left scale-[1.7] object-cover object-left-top transition-opacity duration-500 ease-out motion-reduce:transition-none sm:scale-100 sm:object-top",
                  i === active ? "opacity-100" : "opacity-0",
                )}
              />
            ))}
          </div>
        </div>

        {/* Tabs: a row on desktop, a scrollable strip on phones. */}
        <div
          ref={listRef}
          role="tablist"
          aria-label="Product screens"
          onKeyDown={onKeyDown}
          className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] sm:grid sm:grid-cols-5 sm:overflow-visible"
        >
          {SCREENS.map((screen, i) => (
            <button
              key={screen.key}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              type="button"
              id={`${id}-tab-${i}`}
              aria-selected={i === active}
              aria-controls={`${id}-panel`}
              tabIndex={i === active ? 0 : -1}
              onClick={() => choose(i)}
              className={cn(
                "relative h-10 shrink-0 overflow-hidden rounded-lg px-4 text-sm font-medium transition-colors sm:h-9",
                focusRing,
                i === active
                  ? "bg-white text-neutral-950 shadow-[0_1px_2px_rgba(0,0,0,0.08)] ring-1 ring-neutral-200"
                  : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800",
              )}
            >
              {screen.label}
              {/* The timer. Mounted only on the active tab, so it restarts
                  from zero each time the tab changes. */}
              {i === active && touring && (
                <span
                  aria-hidden="true"
                  className="ls-tour-line absolute inset-x-0 bottom-0 h-0.5 origin-left bg-[#6c5ed1]"
                  style={{
                    animationDuration: `${TOUR_SECONDS}s`,
                    animationPlayState: running ? "running" : "paused",
                  }}
                  onAnimationEnd={() => setActive((a) => (a + 1) % SCREENS.length)}
                />
              )}
            </button>
          ))}
        </div>

        {/* min-h: captions wrap to two lines on phones; reserving both
            keeps the section the same height on every tab. */}
        <div className="mt-3 flex min-h-[2lh] items-start justify-center gap-2 text-sm sm:min-h-0 sm:items-center">
          {/* Announce caption changes only when a person made them; reading
              out every step of the automatic tour would be noise. */}
          <p aria-live={touring ? "off" : "polite"} className="text-center text-sm text-neutral-500">
            {SCREENS[active].caption}
          </p>
          <button
            type="button"
            onClick={() => setTouring((t) => !t)}
            aria-label={touring ? "Pause the product tour" : "Play the product tour"}
            className={cn(
              "-mt-2 grid size-9 shrink-0 place-items-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 motion-reduce:hidden sm:mt-0 sm:size-7",
              focusRing,
            )}
          >
            {touring ? (
              <PauseIcon className="size-3.5" aria-hidden />
            ) : (
              <PlayIcon className="size-3.5" aria-hidden />
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes ls-tour-line { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .ls-tour-line { animation: ls-tour-line linear forwards; }
        /* No animation means no animationend, so the tour never advances. */
        @media (prefers-reduced-motion: reduce) {
          .ls-tour-line { animation: none; display: none; }
        }
      `}</style>
    </Frame>
  );
}

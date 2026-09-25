"use client";

// Mounts the product tour for the whole dashboard shell and decides when it
// runs on its own.
//
// It auto-starts exactly once per workspace, on /dashboard, the first time
// someone lands there after onboarding. The "seen" flag is written before the
// tour opens rather than after it finishes: a tour someone skipped or refreshed
// away from has still been offered, and re-opening itself would be worse than
// not showing it again. The flag is keyed by organisation id, so joining or
// creating a second workspace offers the tour again there.

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Onborda, OnbordaProvider, useOnborda } from "onborda";

import { TourCard } from "./tour-card";
import { DASHBOARD_TOUR, TOUR_SELECTORS, tours } from "./tours";

const SEEN_PREFIX = "letterstack:dashboard-tour-seen";
const seenKeyFor = (organizationId: string) =>
  `${SEEN_PREFIX}:${organizationId}`;

/** The tour's last step points at the Getting Started card. */
const FINAL_TARGET = "#tour-getting-started";
/** How long to wait for the client-fetched dashboard to render it. */
const TARGET_TIMEOUT_MS = 10_000;

function hasSeen(organizationId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(seenKeyFor(organizationId)) === "1";
  } catch {
    // Storage blocked (private window, cleared site data) — treat as seen
    // rather than reopening the tour on every single visit.
    return true;
  }
}

function markSeen(organizationId: string) {
  try {
    window.localStorage.setItem(seenKeyFor(organizationId), "1");
  } catch {
    // Nothing to do — the tour simply isn't remembered for this browser.
  }
}

/**
 * Starts the dashboard tour. Safe to call from anywhere inside the shell;
 * marks the tour as seen so it won't also auto-open later.
 */
export function useDashboardTour(organizationId: string) {
  const { startOnborda } = useOnborda();

  return useCallback(() => {
    markSeen(organizationId);
    startOnborda(DASHBOARD_TOUR);
  }, [organizationId, startOnborda]);
}

/**
 * Stops Onborda scrolling the layout while the tour is open.
 *
 * Onborda calls `scrollIntoView` on a step's target whenever its own
 * visibility check reads false — which happens even when the target is plainly
 * on screen. The shell is `h-screen` with nested `overflow-hidden` containers,
 * and those still scroll programmatically, so each of those calls shifts the
 * whole dashboard and the icon rail with it; stepping back and forth walks the
 * layout further each time.
 *
 * Everything the tour points at is always visible in this layout, so the call
 * has nothing useful to do. It's replaced with a no-op on the anchors for the
 * life of the tour and restored the moment it closes, leaving scrolling
 * everywhere else — and for every other element — untouched.
 */
function useSuppressTourScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const patched: Element[] = [];
    for (const selector of TOUR_SELECTORS) {
      document.querySelectorAll(selector).forEach((element) => {
        (element as Partial<Element>).scrollIntoView = () => {};
        patched.push(element);
      });
    }

    // Belt and braces. Patching the anchors stops the calls we found in
    // Onborda's source, but the card is positioned from live measurements, so
    // anything that scrolls an ancestor mid-step leaves it stranded — and a
    // container scrolled by `scrollIntoView` keeps its new position afterwards.
    //
    // Every ancestor of every anchor has its scroll position recorded while the
    // tour is open and restored the instant something moves it. The overlay
    // already blocks pointer events, so no deliberate scrolling is being undone
    // here; releasing on close leaves each container exactly where it was.
    const frozen = new Map<Element, { top: number; left: number }>();
    for (const element of patched) {
      let node: Element | null = element.parentElement;
      while (node) {
        if (!frozen.has(node)) {
          frozen.set(node, { top: node.scrollTop, left: node.scrollLeft });
        }
        node = node.parentElement;
      }
    }

    // Onborda portals its overlay onto <body> as `absolute inset-0`, and the
    // highlight inside it is a normal-flow box sized to the current target. A
    // tall one (the ~650px Getting Started card) therefore grows the document
    // and gives this h-screen app a window scrollbar — which then scrolls the
    // whole shell, icon rail included.
    //
    // Clipping the document for the life of the tour removes the overflow
    // rather than fighting it. It has to be done here rather than by
    // repositioning the overlay in CSS: `position: fixed` would create a
    // stacking context, trapping the card's z-950 inside it and letting
    // Onborda's own `fixed inset-0 z-[900]` click-blocker paint over the card,
    // which swallows every click on Next and Back. This app's shell is
    // `h-screen` and never scrolls the document anyway, so clipping it changes
    // nothing a user could otherwise do.
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "clip";

    // The window scrolls too, and it reports `document` as the event target
    // rather than an element — so it needs handling of its own.
    const pageTop = window.scrollY;
    const pageLeft = window.scrollX;

    const restore = (event: Event) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        if (window.scrollY !== pageTop || window.scrollX !== pageLeft) {
          window.scrollTo(pageLeft, pageTop);
        }
        return;
      }

      const position = frozen.get(target);
      if (!position) return;
      if (target.scrollTop !== position.top) target.scrollTop = position.top;
      if (target.scrollLeft !== position.left) target.scrollLeft = position.left;
    };

    // Capture phase: scroll events don't bubble, so this is the only way to
    // catch them for every container from one listener.
    document.addEventListener("scroll", restore, true);

    return () => {
      root.style.overflow = previousOverflow;
      document.removeEventListener("scroll", restore, true);
      patched.forEach((element) => {
        // Deleting the own property exposes the prototype's real method again.
        delete (element as Partial<Element>).scrollIntoView;
      });
    };
  }, [active]);
}

function TourAutoStart({ organizationId }: { organizationId: string }) {
  const pathname = usePathname();
  const { startOnborda, isOnbordaVisible } = useOnborda();

  useSuppressTourScroll(isOnbordaVisible);
  // Guards against the effect re-running (organisation switch, route change)
  // and opening the tour a second time within one page life.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    if (pathname !== "/dashboard") return;
    if (hasSeen(organizationId)) return;

    let cancelled = false;
    let observer: MutationObserver | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const begin = () => {
      if (cancelled || started.current) return;
      started.current = true;
      markSeen(organizationId);
      startOnborda(DASHBOARD_TOUR);
    };

    const stop = () => {
      observer?.disconnect();
      if (timeout) clearTimeout(timeout);
    };

    // The dashboard fetches its data in the browser, so the Getting Started
    // card — the tour's last stop — doesn't exist on first paint. Wait for it
    // instead of opening the tour against a target that isn't there yet.
    //
    // If it never arrives the workspace is either fully set up or the guide was
    // dismissed; both mean this person doesn't need the tour, so it's dropped
    // rather than started without its ending.
    if (document.querySelector(FINAL_TARGET)) {
      begin();
      return () => {
        cancelled = true;
        stop();
      };
    }

    observer = new MutationObserver(() => {
      if (document.querySelector(FINAL_TARGET)) {
        stop();
        begin();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    timeout = setTimeout(stop, TARGET_TIMEOUT_MS);

    return () => {
      cancelled = true;
      stop();
    };
  }, [organizationId, pathname, startOnborda]);

  return null;
}

export function TourProvider({
  children,
  organizationId,
}: {
  children: React.ReactNode;
  organizationId: string;
}) {
  return (
    <OnbordaProvider>
      <Onborda
        steps={tours}
        cardComponent={TourCard}
        // The dashboard is dark, so the cut-out reads better as a deep wash
        // than the library's default light-grey veil.
        shadowRgb="8,8,12"
        shadowOpacity="0.72"
        cardTransition={{ type: "spring", stiffness: 260, damping: 26 }}
      >
        <TourAutoStart organizationId={organizationId} />
        {children}
      </Onborda>
    </OnbordaProvider>
  );
}

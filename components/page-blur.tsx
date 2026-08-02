"use client";

import { useEffect, useState } from "react";
import { ProgressiveBlur } from "@/components/progressive-blur";

/**
 * Fixed top & bottom progressive blur overlays that hide
 * when the user is at the very top / very bottom of the page.
 */
export function PageBlur({
  height = "150px",
  blurAmount = "4px",
  backgroundColor = "white",
  threshold = 50,
  hideBottomUntilSelector,
}: {
  /** Height of each blur band */
  height?: string;
  /** Backdrop blur amount */
  blurAmount?: string;
  /** Background color for the gradient */
  backgroundColor?: string;
  /** Scroll distance (px) before blur becomes fully visible */
  threshold?: number;
  /**
   * CSS selector for a leading section (e.g. the hero) over which BOTH blurs
   * should stay hidden — the section owns its own edges, so neither band
   * should overlay it. Both reappear once the section has fully scrolled
   * out of view (its bottom edge passes the TOP of the viewport), not
   * merely once the next section starts peeking in at the bottom — a
   * section taller than one viewport (e.g. a multi-part hero) would
   * otherwise re-reveal the blur while still deep inside it, since "next
   * section visible at the bottom edge" can happen long before the section
   * itself is actually done. Pages without a matching element are
   * unaffected.
   */
  hideBottomUntilSelector?: string;
}) {
  const [scrollState, setScrollState] = useState(() => ({
    atTop: true,
    atBottom: false,
    // Assume we start over the leading section so the bottom blur doesn't
    // flash in for a frame on first paint before the effect measures.
    overLeadingSection: Boolean(hideBottomUntilSelector),
  }));

  useEffect(() => {
    function update() {
      const scrollTop = window.scrollY;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      let overLeadingSection = false;
      if (hideBottomUntilSelector) {
        const el = document.querySelector(hideBottomUntilSelector);
        if (el) overLeadingSection = el.getBoundingClientRect().bottom > 0;
      }

      setScrollState({
        atTop: scrollTop <= threshold,
        atBottom: distanceFromBottom <= threshold,
        overLeadingSection,
      });
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [threshold, hideBottomUntilSelector]);

  const hideTop = scrollState.atTop || scrollState.overLeadingSection;
  const hideBottom = scrollState.atBottom || scrollState.overLeadingSection;

  return (
    <>
      {/* Top blur */}
      <ProgressiveBlur
        position="top"
        height={height}
        blurAmount={blurAmount}
        backgroundColor={backgroundColor}
        className={`fixed z-40 transition-opacity duration-300 ${
          hideTop ? "opacity-0" : "opacity-100"
        }`}
      />

      {/* Bottom blur */}
      <ProgressiveBlur
        position="bottom"
        height={height}
        blurAmount={blurAmount}
        backgroundColor={backgroundColor}
        className={`fixed z-40 transition-opacity duration-300 ${
          hideBottom ? "opacity-0" : "opacity-100"
        }`}
      />
    </>
  );
}

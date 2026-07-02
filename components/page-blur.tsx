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
}: {
  /** Height of each blur band */
  height?: string;
  /** Backdrop blur amount */
  blurAmount?: string;
  /** Background color for the gradient */
  backgroundColor?: string;
  /** Scroll distance (px) before blur becomes fully visible */
  threshold?: number;
}) {
  const [scrollState, setScrollState] = useState({ atTop: true, atBottom: false });

  useEffect(() => {
    function update() {
      const scrollTop = window.scrollY;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      setScrollState({
        atTop: scrollTop <= threshold,
        atBottom: distanceFromBottom <= threshold,
      });
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [threshold]);

  return (
    <>
      {/* Top blur */}
      <ProgressiveBlur
        position="top"
        height={height}
        blurAmount={blurAmount}
        backgroundColor={backgroundColor}
        className={`fixed z-40 transition-opacity duration-300 ${
          scrollState.atTop ? "opacity-0" : "opacity-100"
        }`}
      />

      {/* Bottom blur */}
      <ProgressiveBlur
        position="bottom"
        height={height}
        blurAmount={blurAmount}
        backgroundColor={backgroundColor}
        className={`fixed z-40 transition-opacity duration-300 ${
          scrollState.atBottom ? "opacity-0" : "opacity-100"
        }`}
      />
    </>
  );
}

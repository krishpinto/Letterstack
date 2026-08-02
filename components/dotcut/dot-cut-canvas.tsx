"use client";

import { useEffect, useRef } from "react";

import { DotCut } from "./engine";

/**
 * `ctx.font` doesn't resolve `var(--token)` the way DOM styles do — there's
 * no cascade to walk. Apply the CSS value to a throwaway element and ask
 * the DOM to resolve it via getComputedStyle.
 */
function resolveCss(value: string, prop: "fontFamily"): string {
  const probe = document.createElement("span");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.fontFamily = value;
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe)[prop];
  probe.remove();
  return resolved;
}

/**
 * Resolve a `var(--token)` color to a concrete #rrggbb hex, robust to
 * whatever notation getComputedStyle happens to hand back. This project's
 * shadcn tokens are defined as oklch(...), and modern Chromium's
 * getComputedStyle can return the color in that same oklch() notation
 * rather than normalizing to rgb() — a plain regex expecting "rgb(...)"
 * silently fails on that and falls back to black, which is why an earlier
 * version of this function produced an invisible-on-invisible black panel.
 * Filling a 1x1 canvas and reading the pixel back sidesteps the notation
 * entirely: canvas fillStyle parses any valid CSS color (just not var()),
 * and the pixel buffer it produces is always concrete sRGB bytes.
 */
function resolveToHex(varExpr: string): string {
  const probe = document.createElement("span");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.color = varExpr;
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();

  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const ctx = cv.getContext("2d");
  if (!ctx) return "#000000";
  ctx.fillStyle = resolved;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Fewer columns for a narrower panel keeps each circle a legible size
 * instead of shrinking the whole 42-wide grid into a strip of dust. Keyed
 * on the panel's own rendered width, not the viewport — a panel that's
 * half the page in a split layout needs the same treatment as a full-width
 * one on a small screen, and the tiny icon-pill instances need it taken
 * even further down.
 */
function colsForWidth(w: number): number {
  if (w < 60) return 10;
  if (w < 120) return 14;
  if (w < 200) return 20;
  if (w < 320) return 24;
  if (w < 480) return 30;
  if (w < 768) return 34;
  return 42;
}

export function DotCutCanvas({
  className,
  lockScene,
  startScene,
  paletteVars = ["var(--primary)", "var(--background)"],
}: {
  className?: string;
  /** Pin to one SCENES index forever instead of cycling — for small
   * decorative uses (icon pills) where a fixed texture reads better than
   * six scenes' worth of motion in a 40px shape. */
  lockScene?: number;
  /** Begin the normal cycle at this SCENES index instead of 0. For two
   * instances that should keep animating but stay visibly out of sync
   * with each other, rather than both showing the same scene at once. */
  startScene?: number;
  /**
   * [circle, background] as CSS `var(--token)` expressions, resolved to
   * concrete hex at mount. Defaults to the brand pair (primary mesh over
   * the page background) — pass e.g. `["var(--primary)", "var(--foreground)"]`
   * for a dot texture meant to sit inside an already-dark shape.
   */
  paletteVars?: [string, string];
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const fontFamily = resolveCss("var(--font-bricolage, var(--font-inter))", "fontFamily");
    const dot = new DotCut(host, fontFamily || "sans-serif");
    if (!dot.ok) return;

    dot.setPalette(resolveToHex(paletteVars[0]), resolveToHex(paletteVars[1]));

    dot.setParams({ cols: colsForWidth(host.clientWidth) });
    if (lockScene !== undefined) dot.lockToScene(lockScene);
    else if (startScene !== undefined) dot.startAtScene(startScene);

    const cleanups: Array<() => void> = [() => dot.destroy()];

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      dot.renderStill();
    } else {
      const io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && document.visibilityState === "visible") dot.start();
          else dot.stop();
        },
        { threshold: 0.1 },
      );
      io.observe(host);
      cleanups.push(() => io.disconnect());

      const onVisibility = () => {
        if (document.visibilityState !== "visible") dot.stop();
        else if (host.getBoundingClientRect().bottom > 0) dot.start();
      };
      document.addEventListener("visibilitychange", onVisibility);
      cleanups.push(() => document.removeEventListener("visibilitychange", onVisibility));

      const onResize = () => dot.setParams({ cols: colsForWidth(host.clientWidth) });
      window.addEventListener("resize", onResize);
      cleanups.push(() => window.removeEventListener("resize", onResize));

      const onPointerMove = (e: PointerEvent) => {
        const rect = host.getBoundingClientRect();
        dot.setPointer(dot.toCell(e.clientX - rect.left, e.clientY - rect.top));
      };
      const onPointerLeave = () => dot.setPointer(null);
      host.addEventListener("pointermove", onPointerMove);
      host.addEventListener("pointerleave", onPointerLeave);
      cleanups.push(() => {
        host.removeEventListener("pointermove", onPointerMove);
        host.removeEventListener("pointerleave", onPointerLeave);
      });
    }

    return () => {
      for (const fn of cleanups) fn();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockScene, startScene]);

  // Decorative only — the section still has real DOM heading/CTA text
  // alongside it for accessibility and SEO.
  return <div ref={hostRef} aria-hidden="true" className={className} />;
}

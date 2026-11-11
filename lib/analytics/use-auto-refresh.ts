"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Calls `refresh` once `delayMs` after the last refresh finished, but only
 * while the tab is visible: a hidden tab defers the refresh until it is shown
 * again. Re-arms whenever `busy` goes back to false, so a slow request never
 * overlaps the next one. Clears its timer and listener on unmount.
 */
export function useAutoRefresh({
  enabled,
  busy,
  delayMs,
  refresh,
}: {
  enabled: boolean;
  busy: boolean;
  delayMs: number;
  refresh: () => unknown;
}) {
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });

  useEffect(() => {
    if (!enabled || busy) return;
    let due = false;
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") void refreshRef.current();
      else due = true;
    }, delayMs);
    const onVisibility = () => {
      if (due && document.visibilityState === "visible") {
        due = false;
        void refreshRef.current();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, busy, delayMs]);
}

/** The current time, re-read every `intervalMs` (for "Updated 2 min ago"). */
export function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

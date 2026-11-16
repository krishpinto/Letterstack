"use client";

import { useEffect, useRef } from "react";

// Petals drifting across the meadow on the wind, drawn on one <canvas>.
//
// A canvas, not dozens of animated DOM nodes: one element, one draw loop, no
// layout or style work per petal. The loop only runs while the hero is on
// screen and the tab is visible, and it never starts under
// prefers-reduced-motion.
//
// Each petal has a depth `z` (0 far … 1 near). Depth sets size, speed and
// opacity together, which is what makes a flat layer read as 3D: near petals
// are big, fast and solid; far ones small, slow and faint.

type Petal = {
  x: number;
  y: number;
  z: number;
  rot: number;
  spin: number;
  phase: number;
  sway: number;
};

// Pale petals for the dusk sky; violet ones for the daylight sky, where pale
// would vanish against white.
const PALETTES = {
  light: ["232, 222, 255", "214, 196, 255", "247, 240, 255"],
  violet: ["148, 128, 236", "172, 152, 245", "124, 106, 214"],
} as const;

function makePetal(w: number, h: number, anywhere: boolean): Petal {
  const z = Math.random() ** 1.6; // more far petals than near ones
  return {
    // New petals enter from the left edge or the top; the first batch is
    // spread over the whole canvas so the scene doesn't start empty.
    x: anywhere ? Math.random() * w : -20 - Math.random() * w * 0.3,
    y: anywhere ? Math.random() * h : Math.random() * h * 0.7,
    z,
    rot: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.04,
    phase: Math.random() * Math.PI * 2,
    sway: 0.4 + Math.random() * 0.8,
  };
}

export function Petals({
  className,
  tone = "light",
}: {
  className?: string;
  tone?: keyof typeof PALETTES;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const colors = PALETTES[tone];
    let w = 0;
    let h = 0;
    let petals: Petal[] = [];
    let frame = 0;
    let last = 0;
    let onScreen = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = w < 768 ? 16 : 38;
      petals = Array.from({ length: count }, () => makePetal(w, h, true));
    };

    const draw = (now: number) => {
      // Frame-rate independent: scale movement by elapsed time, capped so a
      // long pause (tab switch) doesn't teleport every petal.
      const dt = Math.min((now - last) / 16.67, 3);
      last = now;
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < petals.length; i++) {
        const p = petals[i];
        const speed = 0.35 + p.z * 1.4;
        p.phase += 0.02 * dt;
        p.x += (0.9 * speed + Math.sin(p.phase) * p.sway * 0.3) * dt;
        p.y += (0.35 * speed + Math.cos(p.phase * 0.7) * p.sway * 0.25) * dt;
        p.rot += p.spin * dt;

        if (p.x > w + 30 || p.y > h + 30) {
          petals[i] = makePetal(w, h, false);
          continue;
        }

        const size = 2 + p.z * 6;
        // Flip the petal's width with its spin so it looks like it tumbles.
        const tumble = Math.abs(Math.cos(p.phase * 1.3));
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = `rgba(${colors[i % colors.length]}, ${0.25 + p.z * 0.6})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, size, size * (0.35 + tumble * 0.25), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      frame = requestAnimationFrame(draw);
    };

    const start = () => {
      if (frame || !onScreen || document.hidden) return;
      last = performance.now();
      frame = requestAnimationFrame(draw);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) start();
      else stop();
    });
    io.observe(canvas);

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);

    start();
    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [tone]);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
}

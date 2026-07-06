"use client";

// Dot-matrix envelope loader. Same engine and mechanics as the dotm-hex-7
// component (stepped frame cycle, opacity triplet, bloom, reduced-motion),
// but the dot grid draws a mail envelope — outline plus the V of the flap —
// and the animation is a light band sweeping across it left to right.

import type { CSSProperties } from "react";

import {
  cx,
  dmxBloomRootActive,
  dmxDotBloomParts,
  remapOpacityToTriplet,
  resolveDmxColorTokens,
  styleOpacity,
  stylePx,
} from "@/lib/dotmatrix-core";
import {
  useDotMatrixPhases,
  usePrefersReducedMotion,
  useSteppedCycle,
} from "@/lib/dotmatrix-hooks";
import type { DotMatrixCommonProps } from "@/lib/dotmatrix-core";

export type DotmMailProps = Omit<DotMatrixCommonProps, "pattern">;

const COLS = 9;
const ROWS = 6;
const BASE_OPACITY = 0.2;
const MID_OPACITY = 0.34;
const HIGH_OPACITY = 0.98;
const STEPS = 6;

// The envelope, as the set of lit grid cells per row: full top and bottom
// edges, side walls, and the flap's V meeting at row 3.
const ENVELOPE: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8], // top edge
  [0, 1, 7, 8], //               sides + flap start
  [0, 2, 6, 8], //               sides + flap middle
  [0, 3, 4, 5, 8], //            sides + flap tip
  [0, 8], //                     sides
  [0, 1, 2, 3, 4, 5, 6, 7, 8], // bottom edge
];

function isEnvelopeDot(row: number, col: number): boolean {
  return ENVELOPE[row]?.includes(col) ?? false;
}

// One frame per step: a bright band sweeps across the columns with a mid
// tail, while the rest of the envelope stays dimly visible.
const FRAMES: readonly Readonly<Record<string, "x" | "o">>[] = Array.from(
  { length: STEPS },
  (_, step) => {
    const center = (step * (COLS - 1)) / (STEPS - 1);
    const frame: Record<string, "x" | "o"> = {};
    for (let row = 0; row < ROWS; row++) {
      for (const col of ENVELOPE[row]) {
        const distance = Math.abs(col - center);
        if (distance < 1) frame[`${row},${col}`] = "x";
        else if (distance < 2.4) frame[`${row},${col}`] = "o";
      }
    }
    return frame;
  },
);

function clamp01(n: number | undefined) {
  if (n == null || !Number.isFinite(n)) {
    return;
  }
  return Math.min(1, Math.max(0, n));
}

export function DotmMail({
  size = 44,
  dotSize = 4,
  color = "currentColor",
  colorPreset,
  ariaLabel = "Loading",
  className,
  muted = false,
  bloom = false,
  halo = 0,
  dotClassName,
  dotShape = "circle",
  speed = 1.9,
  animated = true,
  hoverAnimated = false,
  opacityBase,
  opacityMid,
  opacityPeak,
}: DotmMailProps) {
  const reducedMotion = usePrefersReducedMotion();
  const { phase: matrixPhase, onMouseEnter, onMouseLeave } = useDotMatrixPhases({
    animated: Boolean(animated && !reducedMotion),
    hoverAnimated: Boolean(hoverAnimated && !reducedMotion),
    speed,
  });
  const step = useSteppedCycle({
    active: !reducedMotion && matrixPhase !== "idle",
    cycleMsBase: 1680,
    steps: FRAMES.length,
    speed,
  });
  const frame =
    FRAMES[reducedMotion || matrixPhase === "idle" ? 0 : step] ?? FRAMES[0]!;

  const gap = Math.max(1, Math.floor((size - dotSize * COLS) / (COLS - 1)));
  const matrixWidth = dotSize * COLS + gap * (COLS - 1);
  const matrixHeight = dotSize * ROWS + gap * (ROWS - 1);
  const ob = clamp01(opacityBase);
  const om = clamp01(opacityMid);
  const op = clamp01(opacityPeak);
  const { resolvedColor, dotFill } = resolveDmxColorTokens(color, colorPreset);

  const matrixStyle = {
    width: stylePx(matrixWidth),
    height: stylePx(matrixHeight),
    ["--dmx-dot-fill" as const]: dotFill,
    color: resolvedColor,
    ["--dmx-dot-size" as const]: `${dotSize}px`,
    ["--dmx-halo-level" as const]: halo,
    ...(ob !== undefined && { ["--dmx-opacity-base" as const]: ob }),
    ...(om !== undefined && { ["--dmx-opacity-mid" as const]: om }),
    ...(op !== undefined && { ["--dmx-opacity-peak" as const]: op }),
  } as unknown as CSSProperties;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      className={cx(
        "dmx-root",
        `dmx-dot-shape-${dotShape}`,
        muted && "dmx-muted",
        dmxBloomRootActive(bloom, halo) && "dmx-bloom",
        className,
      )}
      style={matrixStyle}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: stylePx(gap),
          width: "100%",
          height: "100%",
        }}
      >
        {Array.from({ length: ROWS }).map((_, row) => (
          <div key={row} style={{ display: "flex", gap: stylePx(gap) }}>
            {Array.from({ length: COLS }).map((_, col) => {
              const isActive = isEnvelopeDot(row, col);
              const tone = frame[`${row},${col}`];
              const opacity = isActive
                ? tone === "x"
                  ? HIGH_OPACITY
                  : tone === "o"
                    ? MID_OPACITY
                    : BASE_OPACITY
                : 0;
              const dmxBloom = dmxDotBloomParts(
                isActive,
                opacity,
                bloom,
                halo,
                ob,
                om,
                op,
              );

              return (
                <span
                  key={`${row},${col}`}
                  aria-hidden="true"
                  className={cx(
                    "dmx-dot",
                    !isActive && "dmx-inactive",
                    dmxBloom.bloomDot && "dmx-bloom-dot",
                    dotClassName,
                  )}
                  style={
                    {
                      width: stylePx(dotSize),
                      height: stylePx(dotSize),
                      opacity: styleOpacity(
                        remapOpacityToTriplet(opacity, ob, om, op),
                      ),
                      ["--dmx-bloom-level" as const]: dmxBloom.level,
                      transition: "opacity 200ms ease-out",
                    } as CSSProperties
                  }
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

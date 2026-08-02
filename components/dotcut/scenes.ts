// Adapted from the provided dotcut spec. Changes from the original demo:
//
// 1. `rasterize` gains an "icon" kind (a mail/envelope glyph drawn as a
//    Path2D and sampled at grid resolution, same technique as the "text"
//    kind) so the cycle can carve an envelope, not just a single letter.
// 2. Palette is no longer six fixed hue pairs baked into each Scene — it's
//    a per-DotCut-instance field (see engine.ts's setPalette()), so every
//    instance on the page (the big hero panel, each icon pill) can carry
//    its own colors without a shared module-level array clobbering them.
// 3. Text/icon rasterization is bolder (weight 800, larger) than the
//    original demo's 600 — the spec itself calls out that only bold,
//    closed, high-contrast forms survive at this cell count, and the
//    original weight left the "L" scene hard to read at a glance.

export interface Scene {
  kind: "text" | "icon" | "rings" | "checker" | "bars" | "columns" | "boxes";
  value?: string;
  transition: TransitionKind;
  style?: StyleKind;
}

export type TransitionKind =
  | "wipe"
  | "ripple"
  | "scatter"
  | "collapse"
  | "columns";

export function cellMotion(
  kind: TransitionKind,
  t: number,
  dir: number,
  rand: number,
): { scale: number; dx: number; dy: number; spin: number } {
  const u = Math.sin(Math.min(1, Math.max(0, t)) * Math.PI);
  switch (kind) {
    case "wipe":
      return { scale: 1, dx: u * 0.16 * -dir, dy: 0, spin: 0 };
    case "ripple":
      return { scale: 1 - u * 0.10, dx: 0, dy: u * -0.13, spin: 0 };
    case "scatter":
      return {
        scale: 1,
        dx: u * 0.18 * Math.cos(rand * Math.PI * 2),
        dy: u * 0.18 * Math.sin(rand * Math.PI * 2),
        spin: 0,
      };
    case "collapse":
      return { scale: 1 - u * 0.18, dx: 0, dy: 0, spin: 0 };
    case "columns":
      return { scale: 1, dx: 0, dy: u * 0.22, spin: 0 };
  }
}

export type StyleKind = "drift" | "grain" | "swell" | "streak" | null;

function smooth01(v: number, e0: number, e1: number): number {
  const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// One letter (the wordmark initial), one mail glyph, then the four full-bleed
// textures from the original spec. Two contained figures instead of one —
// "L" for the brand, an envelope because this is an email product — flanked
// by full-bleed patterns so both still read as events against the noise.
export const SCENES: Scene[] = [
  { kind: "text", value: "L", transition: "wipe", style: "drift" },
  { kind: "icon", value: "mail", transition: "ripple", style: "grain" },
  { kind: "columns", transition: "columns", style: "streak" },
  { kind: "checker", transition: "scatter", style: "swell" },
  { kind: "boxes", transition: "collapse", style: "grain" },
  { kind: "rings", transition: "wipe", style: "drift" },
  { kind: "icon", value: "send", transition: "collapse", style: "swell" },
];

export function styleField(
  scene: Scene,
  cols: number,
  rows: number,
  t: number,
  out: Float32Array,
  prev?: Scene,
) {
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const maxR = Math.hypot(cols, rows) / 2;

  const FLIP = 0.32;

  const stateOf = (style: StyleKind | undefined, x: number, y: number): number => {
    switch (style) {
      case "drift": {
        const a = Math.sin(x * 0.41 + y * 0.23);
        const b = Math.sin(x * 0.17 - y * 0.53 + 2.1);
        return smooth01((a + b) * 0.5, -0.15, 0.75);
      }
      case "grain": {
        const n =
          hash2(x, y) * 0.55 +
          hash2(x + 1, y) * 0.15 +
          hash2(x, y + 1) * 0.15 +
          hash2(x + 1, y + 1) * 0.15;
        return smooth01(n, 0.34, 0.86);
      }
      case "swell": {
        const d = Math.hypot(x - cx, y - cy) / maxR;
        const warp = Math.sin(Math.atan2(y - cy, x - cx) * 3.0) * 0.14;
        return smooth01(1 - (d + warp), 0.28, 0.92);
      }
      case "streak": {
        const s = Math.sin(x * 0.28 + y * 0.62);
        const cut = Math.sin(x * 0.09 - y * 0.11 + 1.3) * 0.5 + 0.5;
        return smooth01(s * cut, -0.05, 0.7);
      }
      default:
        return 0;
    }
  };

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let order = 0;
      switch (scene.style) {
        case "drift":
          order = (x / cols) * 0.75 + Math.sin(y * 0.5) * 0.12 + 0.12;
          break;
        case "grain":
          order = (x / cols) * 0.55 + (y / rows) * 0.25 + hash2(x, y) * 0.2;
          break;
        case "swell":
          order = Math.hypot(x - cx, y - cy) / maxR;
          break;
        case "streak":
          order = (x / cols) * 0.8 + (y / rows) * 0.2;
          break;
      }

      const from = stateOf(prev?.style ?? scene.style, x, y);
      const to = stateOf(scene.style, x, y);
      const u = Math.min(1, Math.max(0, (t - order * (1 - FLIP)) / FLIP));
      const eased = u * u * (3 - 2 * u);
      out[y * cols + x] = from + (to - from) * eased;
    }
  }
}

// Hand-simplified silhouettes, not the literal Lucide paths — at pill scale
// (a wide, short capsule has maybe 10-14 grid rows to work with, nowhere
// near the big square panel's resolution) a thin accent line or fine joint
// just dissolves into noise. Every one of these is one big bold closed
// region so it still reads at low cell counts.
const ICON_PATHS: Record<string, string> = {
  // "House"/envelope silhouette: a peaked roof (the flap) over a solid
  // body — reads as an envelope without needing the thin diagonal fold
  // line the real icon uses.
  mail: "M2 10 L12 2 L22 10 L22 21 Q22 22 21 22 L3 22 Q2 22 2 21 Z",
  // Bold notched arrow (paper plane), no thin tip.
  send: "M2 12 L22 3 L14 12 L22 21 Z",
};

export function rasterize(
  scene: Scene,
  cols: number,
  rows: number,
  fontFamily: string,
): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(cols * rows)).fill(1);

  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;

  if (scene.kind === "checker") {
    const b = Math.max(2, Math.round(cols / 14));
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if ((Math.floor(x / b) + Math.floor(y / b)) % 2 === 0) out[y * cols + x] = 0;
      }
    }
    return out;
  }

  if (scene.kind === "bars") {
    const period = 3;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (Math.floor((x + y) / period) % 2 === 0) out[y * cols + x] = 0;
      }
    }
    return out;
  }

  if (scene.kind === "columns") {
    const bw = 4;
    const bh = 3;
    for (let y = 0; y < rows; y++) {
      const band = Math.floor(y / bh);
      const shift = band % 2 === 0 ? 0 : bw / 2;
      for (let x = 0; x < cols; x++) {
        if (Math.floor((x + shift) / bw) % 2 === 0) out[y * cols + x] = 0;
      }
    }
    return out;
  }

  if (scene.kind === "boxes") {
    const period = 2.5;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const d = Math.max(Math.abs(x - cx), Math.abs(y - cy));
        if (Math.floor(d / period) % 2 === 0) out[y * cols + x] = 0;
      }
    }
    return out;
  }

  if (scene.kind === "rings") {
    const maxR = Math.hypot(cols, rows) / 2;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const d = Math.hypot(x - cx, y - cy) / maxR;
        if (Math.floor(d * 6.0) % 2 === 0) out[y * cols + x] = 0;
      }
    }
    return out;
  }

  // "text" and "icon" share the same rasterize-then-threshold technique:
  // draw white-on-black at grid resolution, remove any circle whose sample
  // falls on the glyph.
  const cv = document.createElement("canvas");
  cv.width = cols;
  cv.height = rows;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return out;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, cols, rows);
  ctx.fillStyle = "#fff";

  if (scene.kind === "icon") {
    const d = ICON_PATHS[scene.value ?? "mail"];
    if (!d) return out;
    const path = new Path2D(d);
    // Path is authored on a 24x24 viewBox; scale to ~64% of grid height,
    // centered, matching the text sizing rule in the spec.
    const target = rows * 0.64;
    const scale = target / 24;
    ctx.save();
    ctx.translate(cols / 2 - (24 * scale) / 2, rows / 2 - (24 * scale) / 2);
    ctx.scale(scale, scale);
    ctx.fill(path);
    ctx.restore();
  } else {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const text = (scene.value || "").trim();
    if (!text) return out;

    let size = rows * 0.86;
    ctx.font = `800 ${size}px ${fontFamily}`;
    const maxW = cols * 0.4;
    const m = ctx.measureText(text);
    if (m.width > maxW) {
      size *= maxW / m.width;
      ctx.font = `800 ${size}px ${fontFamily}`;
    }

    const maxH = rows * 0.62;
    const mm = ctx.measureText(text);
    const gh = mm.actualBoundingBoxAscent + mm.actualBoundingBoxDescent;
    if (gh > maxH) {
      size *= maxH / gh;
      ctx.font = `800 ${size}px ${fontFamily}`;
    }
    ctx.fillText(text, cols / 2, rows / 2 + rows * 0.02);
  }

  const data = ctx.getImageData(0, 0, cols, rows).data;
  for (let i = 0; i < cols * rows; i++) {
    if (data[i * 4] > 110) out[i] = 0;
  }
  return out;
}

export function cellDelay(
  kind: TransitionKind,
  x: number,
  y: number,
  cols: number,
  rows: number,
  rand: number,
): number {
  const fx = cols > 1 ? x / (cols - 1) : 0;
  const fy = rows > 1 ? y / (rows - 1) : 0;
  switch (kind) {
    case "wipe":
      return Math.min(1, Math.max(0, (fx * 0.75 + fy * 0.25) * 0.85 + rand * 0.15));
    case "ripple": {
      const d = Math.hypot(fx - 0.5, fy - 0.5) / 0.707;
      return Math.min(1, d * 0.9 + rand * 0.10);
    }
    case "scatter":
      return rand;
    case "collapse": {
      const d = Math.hypot(fx - 0.5, fy - 0.5) / 0.707;
      return Math.min(1, (1 - d) * 0.85 + rand * 0.15);
    }
    case "columns":
      return Math.min(1, fx * 0.9 + rand * 0.10);
  }
}

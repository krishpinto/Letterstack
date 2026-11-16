// Paper planes (the LetterStack logo glyph) crossing the meadow sky.
//
// Each plane is a small element moved by one CSS animation, with a short
// fading trail behind it. Positions and distances are in container units
// (cqw/cqh: percent of the scene's own width/height), so a flight keeps the
// same route on a phone and on a 2560px monitor.
//
// The routes are chosen to stay clear of the copy, which sits in the middle
// of the upper half of the scene:
//   - "high"    crosses in the thin strip above the headline,
//   - "horizon" crosses low, between the buttons and the hills,
//   - "away"    two planes that climb off at the far left and right edges,
//               shrinking and fading as if heading into the distance.
//
// Under prefers-reduced-motion nothing moves; one still plane is shown so
// the sky isn't empty.

// The logo's plane outline (components/brand-logo.tsx), in its 256×256 box.
// Its nose points up-right; PLANE_ALIGN turns it to point along +x and
// centres it on the origin.
const PLANE_PATH =
  "M63.9536 115.28C60.4547 116.441 56.8086 117.083 53.3988 118.534C50.4161 119.809 47.0834 119.967 44.1665 121.384C44.4781 123.354 46.0541 124.69 47.7466 125.53C57.9442 130.974 68.7273 135.327 78.9105 140.817C81.6556 142.011 81.5198 145.398 82.151 147.882C83.3074 156.016 85.9932 163.821 88.302 171.707C90.4298 178.449 92.4798 185.247 95.2038 191.786C95.869 193.527 97.1525 194.931 98.536 196.145C99.3994 194.619 100.238 193.075 101.368 191.724C107.63 184.067 115.05 177.291 120.491 168.961C125.289 171.351 129.664 174.502 134.412 176.986C135.788 176.378 136.535 174.935 137.392 173.779C144.278 162.94 152.43 152.987 160.372 142.937C160.459 142.532 160.631 141.702 160.719 141.297C163.836 137.72 166.597 133.81 169.941 130.436C176.459 123.846 182.044 116.427 187.912 109.289C195.905 98.0577 206.038 88.5729 214.881 78.0544C215.805 76.779 215.734 75.0966 216.045 73.6361C214.628 73.578 213.175 73.5689 211.759 73.7929C191.541 77.4466 172.082 84.259 152.215 89.3121C122.448 96.6909 92.7474 104.624 63.9536 115.28ZM99.9329 188.541C99.9705 182.89 100.132 177.197 99.455 171.55C98.8823 166.559 98.2284 161.603 97.8037 156.589C104.357 160.221 110.907 163.832 117.492 167.394C110.819 173.683 105.352 181.17 99.9329 188.541ZM182.229 108.559C171.581 121.361 160.71 133.981 150.408 147.053C145.99 152.811 141.792 158.73 138.077 164.963C136.655 167.338 135.138 169.663 133.498 171.898C121.962 165.384 109.858 159.938 98.5101 153.112C107.391 144.477 116.868 136.463 125.665 127.711C130.983 122.44 136.602 117.426 141.586 111.817C142.812 110.668 143.104 108.95 143.352 107.369C139.733 108.18 136.571 110.243 133.311 111.953C116.833 121.313 99.6611 129.435 83.4015 139.216C77.7971 135.694 71.625 133.24 65.6995 130.29C60.8957 127.858 56.0241 125.545 51.2847 122.972C62.79 116.962 75.4919 113.998 87.823 110.332C108.126 104.341 128.645 99.1634 149.258 94.4483C168.871 89.9783 187.971 83.5048 207.713 79.5789C199.086 89.1297 190.43 98.6414 182.229 108.559Z";
const PLANE_ALIGN = "rotate(46) translate(-130 -135)";

type Flight = {
  id: string;
  /** Where the plane's track starts, as a percent of the scene height. */
  top: string;
  /** Start and end offsets from the left edge / from `top`. */
  from: [x: string, y: string];
  to: [x: string, y: string];
  /** Tilt of the plane, matching the slope of its route. */
  tilt: string;
  /** Glyph width in px, and the scale it starts and ends at. */
  size: number;
  scale: [number, number];
  opacity: number;
  seconds: number;
  /** Negative = already part-way through its flight when the page loads. */
  delay: number;
  /** Flying right to left. */
  leftward?: boolean;
  trail?: boolean;
};

const FLIGHTS: Flight[] = [
  {
    id: "horizon",
    top: "63%",
    from: ["-10cqw", "0cqh"],
    to: ["108cqw", "-7cqh"],
    tilt: "-3deg",
    size: 30,
    scale: [1, 1],
    opacity: 0.95,
    seconds: 28,
    delay: -9,
    trail: true,
  },
  {
    id: "high",
    top: "5%",
    from: ["108cqw", "0cqh"],
    to: ["-10cqw", "1.5cqh"],
    tilt: "1deg",
    size: 18,
    scale: [1, 1],
    opacity: 0.55,
    seconds: 44,
    delay: -30,
    leftward: true,
    trail: true,
  },
  {
    id: "away-left",
    top: "62%",
    from: ["-6cqw", "0cqh"],
    to: ["13cqw", "-18cqh"],
    tilt: "-24deg",
    size: 24,
    scale: [1, 0.25],
    opacity: 0.8,
    seconds: 19,
    delay: -3,
  },
  {
    id: "away-right",
    top: "58%",
    from: ["106cqw", "0cqh"],
    to: ["88cqw", "-16cqh"],
    tilt: "22deg",
    size: 22,
    scale: [1, 0.25],
    opacity: 0.75,
    seconds: 23,
    delay: -13,
    leftward: true,
  },
];

function Glyph({ size, ink }: { size: number; ink: string }) {
  return (
    <svg viewBox="-100 -75 200 150" width={size} height={size * 0.75} className="shrink-0">
      <path d={PLANE_PATH} transform={PLANE_ALIGN} fill={ink} />
    </svg>
  );
}

export function PaperPlanes({
  className,
  tone = "light",
}: {
  className?: string;
  /** "light": white planes for a dark sky. "dark": ink planes for a light sky. */
  tone?: "light" | "dark";
}) {
  const ink = tone === "light" ? "#ffffff" : "#2a1f5c";

  return (
    <div aria-hidden="true" className={className}>
      {FLIGHTS.map((f) => (
        <div
          key={f.id}
          className="ls-flight absolute left-0"
          style={
            {
              top: f.top,
              animationDuration: `${f.seconds}s`,
              animationDelay: `${f.delay}s`,
              "--x0": f.from[0],
              "--y0": f.from[1],
              "--x1": f.to[0],
              "--y1": f.to[1],
              "--tilt": f.tilt,
              "--s0": f.scale[0],
              "--s1": f.scale[1],
              "--o": f.opacity,
            } as React.CSSProperties
          }
        >
          {/* Flipped as a whole for right-to-left flights, so the trail is
              always behind the plane. */}
          <div
            className="flex items-center"
            style={f.leftward ? { transform: "scaleX(-1)" } : undefined}
          >
            {f.trail && (
              <span
                className="h-px w-[min(16cqw,180px)]"
                style={{
                  background: `linear-gradient(to right, transparent, ${ink})`,
                  opacity: 0.3,
                }}
              />
            )}
            <Glyph size={f.size} ink={ink} />
          </div>
        </div>
      ))}

      {/* Reduced motion: one plane, parked in the strip above the headline. */}
      <div className="ls-plane-still absolute left-[10cqw] top-[2.5%] -rotate-6 opacity-80">
        <Glyph size={24} ink={ink} />
      </div>

      <style>{`
        @keyframes ls-fly {
          from { transform: translate(var(--x0), var(--y0)) rotate(var(--tilt)) scale(var(--s0)); }
          to { transform: translate(var(--x1), var(--y1)) rotate(var(--tilt)) scale(var(--s1)); }
        }
        /* Fade in after take-off and out before the end, so planes never pop. */
        @keyframes ls-fly-fade {
          0% { opacity: 0; }
          10% { opacity: var(--o); }
          80% { opacity: var(--o); }
          100% { opacity: 0; }
        }
        .ls-flight {
          opacity: 0;
          animation-name: ls-fly, ls-fly-fade;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        .ls-plane-still { display: none; }
        @media (prefers-reduced-motion: reduce) {
          .ls-flight { display: none; }
          .ls-plane-still { display: block; }
        }
      `}</style>
    </div>
  );
}

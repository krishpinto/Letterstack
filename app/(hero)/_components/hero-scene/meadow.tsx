import Image from "next/image";

import { cn } from "@/lib/utils";

import { PaperPlanes } from "./paper-planes";
import { Petals } from "./petals";

// The meadow, the page's one expressive image, at two times of day.
//
//   "day"   the hero. A white sky (it blends into the white navbar) warming
//           to lavender at the horizon, with the hills along the bottom.
//   "dusk"  the closing call to action. The same hills under a purple evening
//           sky. The page opens in daylight and ends at dusk.
//
// The scene is full-bleed: it runs past the page's side rails, so wide screens
// get scenery instead of empty white. By day it fades out across the margins
// (light into white is a soft edge). At dusk it runs edge to edge as a solid
// band, because a dark scene fading into white just looks foggy. The copy
// (children) stays inside the 1200px column, and the rails are drawn on top
// so the page grid continues through the scene.
//
// Nothing reacts to scroll. The only motion is ambient: planes crossing, a few
// petals and (at dusk) the sky drifting very slowly.
//
// The scene box is a size container, so layers are placed in cqw/cqh (percent
// of the scene's own width/height). Each hill image is sized from the scene
// width by its own aspect ratio, so it is never cropped from the top, and its
// top is set so the crest always lands at the same height of the scene:
//   top = crestTarget − crestFractionOfImage × imageHeight

// Opaque between the rails, fading to nothing across each margin. On screens
// narrower than the column the stops collapse and the mask is fully opaque.
const BLEED_MASK =
  "linear-gradient(to right, transparent 0, black calc((100% - 1200px) / 2), black calc(100% - (100% - 1200px) / 2), transparent 100%)";

// By day the scene also dissolves into the page along its bottom edge, so
// the hills never end on a hard line. (The product preview that follows is
// pulled up over this soft edge.) Both gradients are applied together and
// intersected.
const DAY_MASK = `${BLEED_MASK}, linear-gradient(to bottom, black calc(100% - min(140px, 22vw)), transparent calc(100% - 8px))`;

// The hill sources are 1440px wide, so there is nothing to gain from asking
// for more than that.
const IMAGE_SIZES = "(min-width: 1440px) 1440px, 100vw";

export function Meadow({
  time,
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { time: "day" | "dusk" }) {
  const day = time === "day";

  return (
    <section
      className={cn(
        "relative w-full scroll-mt-14 overflow-hidden border-b border-neutral-200",
        className,
      )}
      {...props}
    >
      {/* ── The scene ── */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 left-1/2 w-full -translate-x-1/2 overflow-hidden [container-type:size]",
          day && "max-w-[2000px]",
        )}
        style={
          day
            ? {
                maskImage: DAY_MASK,
                WebkitMaskImage: DAY_MASK,
                maskComposite: "intersect",
                // Safari's prefixed property uses the older keyword.
                WebkitMaskComposite: "source-in",
              }
            : undefined
        }
      >
        {day ? (
          <>
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, #ffffff 0%, #ffffff 20%, #f4f1ff 44%, #dcd3ff 64%, #b9aaf6 80%)",
              }}
            />
            {/* Soft sun on the horizon: the light source. */}
            <div
              className="absolute left-1/2 top-[72%] h-[70%] w-[min(120%,1500px)] -translate-x-1/2 -translate-y-1/2"
              style={{
                background:
                  "radial-gradient(ellipse 45% 45% at 50% 50%, rgba(255,255,255,0.9), rgba(255,255,255,0.25) 50%, transparent 72%)",
              }}
            />
            <PaperPlanes tone="dark" className="absolute inset-0 h-full w-full" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-[#2a1a78]" />
            <div className="absolute inset-x-0 top-0 h-[72%] overflow-hidden">
              <Image
                src="/hero-top.webp"
                alt=""
                fill
                sizes={IMAGE_SIZES}
                className="ls-sky object-cover object-bottom [filter:saturate(0.85)]"
              />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-transparent to-[#2a1a78]" />
            </div>
            {/* Darken the top of the sky so the eye drops to the horizon. */}
            <div className="absolute inset-x-0 top-0 h-[45%] bg-gradient-to-b from-[#0e0630]/60 to-transparent" />
            {/* Dusk glow low on the horizon, behind the far hill's crest. */}
            <div
              className="absolute left-1/2 top-[55%] h-[80%] w-[min(150%,1700px)] -translate-x-1/2 -translate-y-1/2"
              style={{
                background:
                  "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(238,222,255,0.6), rgba(186,160,255,0.22) 45%, transparent 72%)",
              }}
            />
            <PaperPlanes className="absolute inset-0 h-full w-full" />
            {/* Far hill: 808/1440 = 56.1cqw tall, crest 29% down the image,
                pinned at 56% of the scene. */}
            <div className="absolute inset-x-0 [--hf:max(56.1cqw,62cqh)] [height:var(--hf)] [top:calc(56%-0.29*var(--hf))]">
              <Image
                src="/herobg2.webp"
                alt=""
                fill
                sizes={IMAGE_SIZES}
                className="object-cover object-top opacity-90"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to bottom, transparent 0%, rgba(154,134,245,0.22) 28%, rgba(90,68,196,0.08) 55%, transparent 80%)",
                }}
              />
            </div>
          </>
        )}

        {/* Near hills: 1014/1440 = 70.4cqw tall, crest 45.6% down the image.
            Pinned lower by day (74%) so the white sky has room for the copy,
            higher at dusk (67%). */}
        <div
          className={cn(
            "absolute inset-x-0 [height:var(--hn)]",
            day
              ? "[--hn:max(70.4cqw,70cqh)] [top:calc(74%-0.456*var(--hn))]"
              : "[--hn:max(70.4cqw,80cqh)] [top:calc(67%-0.456*var(--hn))]",
          )}
        >
          <Image
            src="/herobg1.webp"
            alt=""
            fill
            // Both scenes use this file at the same sizes, so the second use
            // comes from the cache. Eager everywhere: it is the first screen's
            // largest image, and a lazy second copy made Next's dev check
            // misreport the first as a lazy LCP.
            loading="eager"
            fetchPriority={day ? "high" : undefined}
            sizes={IMAGE_SIZES}
            className="object-cover object-top"
          />
        </div>

        <Petals
          tone={day ? "violet" : "light"}
          className="absolute inset-0 h-full w-full"
        />
      </div>

      {/* ── The page rails, continued through the scene ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-full max-w-[1200px] -translate-x-1/2 sm:block"
      >
        {["left-0", "right-0"].map((side) => (
          <div
            key={side}
            className={cn("absolute inset-y-0 w-px", side)}
            style={{
              // By day the rails run down the white sky and fade out before
              // they reach the hills; a line through the hills read as a seam.
              background: day
                ? "linear-gradient(to bottom, #e5e5e5 0%, #e5e5e5 38%, transparent 62%)"
                : "rgba(255,255,255,0.14)",
            }}
          />
        ))}
      </div>

      {/* ── Copy ── */}
      {/* No z-index here on purpose: a z-index would make this a stacking
          context and trap the contact form's full-screen takeover (rendered
          inside it) underneath the sticky navbar. Coming later in the DOM is
          enough to paint it above the scene. */}
      <div className="relative mx-auto h-full w-full max-w-[1200px]">{children}</div>

      {!day && (
        <style>{`
          /* The dusk sky breathes sideways very slowly. Scale gives the drift
             room without exposing an edge. */
          @keyframes ls-sky-drift {
            from { transform: scale(1.08) translateX(-1.5%); }
            to { transform: scale(1.08) translateX(1.5%); }
          }
          .ls-sky { animation: ls-sky-drift 60s ease-in-out infinite alternate; }
          @media (prefers-reduced-motion: reduce) {
            .ls-sky { animation: none; transform: scale(1.08); }
          }
        `}</style>
      )}
    </section>
  );
}

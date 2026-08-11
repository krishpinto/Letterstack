import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { RichButton } from "@/components/rich-button";
import { ProgressiveBlur } from "@/components/progressive-blur";

// Two stacked halves sharing one hero image that straddles the seam
// between them, not a single flat section.
//
// Half 1 — hero-top.png (purple sky/clouds photo), headline/CTA.
// Half 2 — hero-bottom.png as the base (sky-into-meadow photo), with the
//   meadow image (herobg1.png) anchored to the bottom on top of it, plus a
//   second copy of that same image at 16% opacity sitting behind it and
//   nudged up, for a layered/echoed depth effect.

const BULLETS = [
  "No per-contact pricing",
  "Real HTML, not screenshots",
  "Send from your own domain",
];

export function Hero() {
  return (
    <section data-hero-section className="relative overflow-hidden">
      {/* ── Half 1: sky photo ────────────────────────────────────────── */}
      {/* bg-cover below lg: on a narrow-but-tall viewport (most phones),
          min-h-[75vh] can exceed this image scaled to 100% width, and
          100%-auto (no cover) would leave a blank gap under it instead of
          filling the box. cover guarantees full coverage on any aspect
          ratio, so it's the safe default. Only from lg: up — where the
          section is reliably wider than it is tall — do we switch to the
          exact-100%-width sizing that keeps this in scale with
          hero-bottom.png below (see that comment for why that matters);
          both halves switch at the same breakpoint so they're never scaled
          differently from each other. */}
      <div
        className="relative flex min-h-[75vh] flex-col items-center justify-center overflow-hidden bg-cover bg-bottom bg-no-repeat px-6 pb-28 pt-28 text-center lg:bg-[length:100%_auto] lg:pb-32 lg:pt-32"
        style={{ backgroundImage: "url('/hero-top.png')" }}
      >
        <div className="relative z-10 flex flex-col items-center gap-5">
          <h1
            className="max-w-6xl text-2xl font-bold leading-[1.05] tracking-tight text-white drop-shadow-sm sm:text-4xl sm:leading-[1] md:text-5xl lg:text-6xl lg:leading-[0.98] xl:text-7xl"
            style={{ fontFamily: "var(--font-bricolage, var(--font-inter))" }}
          >
            Mass email.
            <br />
            For companies.
            <br />
            Actually delivered.
          </h1>
          <p className="max-w-md text-base leading-relaxed text-white/90 sm:text-lg">
            Real responsive HTML instead of a flattened screenshot, sent from
            your own domain.
          </p>

          {/* Same glossy/inset-shadow treatment as the navbar's CTA
              (RichButton), just the dark "default" color instead of
              primary — rounded-full overrides RichButton's own
              rounded-md so it keeps reading as a pill, not a chunky
              rectangle. */}
          <RichButton color="default" size="lg" className="mt-2 gap-2 rounded-full" asChild>
            <Link href="/signup">
              Join waitlist
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </RichButton>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-white/80">
            {BULLETS.map((bullet, i) => (
              <span key={bullet} className="flex items-center gap-3">
                {i > 0 && <span className="text-white/50">·</span>}
                {bullet}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Half 2: meadow image sandwiching the product shot ──────────── */}
      {/* Three explicitly z-indexed layers instead of DOM order, so which
          one occludes which doesn't depend on where each sits in the
          markup: 0 = faded echo (backmost), 10 = the hero image
          (container only — swap this for whatever image later), 20 = the
          front meadow, which sits ON TOP of the image and occludes its
          lower portion wherever the PNG is opaque (the flowers), letting
          the transparent upper part of the same PNG show the image
          through everywhere else. */}
      <div className="relative">
        <div
          className="absolute inset-0 overflow-hidden bg-cover bg-top bg-no-repeat lg:bg-[length:100%_auto]"
          style={{ backgroundImage: "url('/hero-bottom.png')" }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 -translate-y-20 scale-x-[-1] opacity-[0.16]"
            style={{
              backgroundImage: "url('/herobg1.png')",
              backgroundSize: "cover",
              backgroundPosition: "center bottom",
              backgroundRepeat: "no-repeat",
            }}
          />
        </div>

        {/* Fog on the distant scenery, not the near mountain — sits behind
            both the screenshot (z-10) and the front hill layer (z-20), so
            it only shows through where those are transparent (the sky
            above the front ridge), hazing what's actually far away instead
            of the closest, most-in-focus layer. Normal blend with a muted
            tone from the gradient's own palette, not screen — screen only
            lightens toward white, which read as a pale, out-of-place wash
            rather than atmospheric haze. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-2/3"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(108,94,209,0.55) 55%, rgba(38,16,110,0.75) 100%)",
          }}
        />

        {/* Hero image container — currently just image-hero.png; swap for
            other images later without touching the layering above/below.
            The hill (z-20, below) is bottom-anchored and sized off width
            (background-size: cover on a wide image), so its own rendered
            height doesn't change here — growing this padding only adds
            headroom above it, which is what actually reveals more of the
            image instead of moving/resizing the hill itself. */}
        <div className="relative z-10 mx-auto max-w-6xl px-6 pb-56 sm:pb-72 lg:pb-96">
          <Image
            src="/image-hero.png"
            alt="LetterStack editor"
            width={800}
            height={409}
            className="relative w-full -translate-y-[18%] rounded-xl border border-black/10 shadow-2xl"
          />
        </div>

        {/* Zoomed in slightly (115% instead of exactly cover's 100%) rather
            than translated, so the ridge sits a bit higher in frame while
            staying bottom-anchored — a translate previously opened a gap at
            the container's bottom edge (the image moved up and away from
            it), which is what exposed the screenshot's raw bottom edge
            below instead of it staying tucked behind the hills. Plain
            bg-cover below lg: for the same gap-safety reason as the two
            backgrounds above — a fixed 115% zoom has no cover-style
            fallback, so on a narrow/tall viewport it can undershoot the
            container just like plain 100% auto could. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 bg-cover bg-bottom bg-no-repeat lg:bg-[length:115%_auto]"
          style={{ backgroundImage: "url('/herobg1.png')" }}
        />

        {/* Solid (unblurred) fade into the page background, so this
            section's own bottom edge softens into whatever comes next
            instead of cutting off sharply. */}
        <ProgressiveBlur
          full
          position="bottom"
          height="400px"
          backgroundColor="var(--background)"
          className="z-30"
        />
      </div>
    </section>
  );
}

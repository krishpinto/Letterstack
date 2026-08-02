import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { RichButton } from "@/components/rich-button";
import { ProgressiveBlur } from "@/components/progressive-blur";

// Two stacked halves sharing one hero image that straddles the seam
// between them, not a single flat section.
//
// Half 1 — 2-stop gradient (purple at bottom, dark indigo at top),
//   headline/CTA.
// Half 2 — the meadow image (herobg1.png) anchored to the bottom, plus a
//   second copy of the same image at 16% opacity sitting behind it and
//   nudged up, for a layered/echoed depth effect.

const BULLETS = [
  "No per-contact pricing",
  "Real HTML, not screenshots",
  "Send from your own domain",
];

export function Hero() {
  return (
    <section data-hero-section className="relative overflow-hidden">
      {/* ── Half 1: gradient ─────────────────────────────────────────── */}
      <div
        className="relative flex min-h-[75vh] flex-col items-center justify-center overflow-hidden px-6 pb-56 pt-28 text-center lg:pb-64 lg:pt-32"
        style={{
          backgroundImage:
            "linear-gradient(to top, #6C5ED1 0%, #26106E 100%)",
        }}
      >
        <div className="relative flex flex-col items-center gap-5">
          <h1
            className="max-w-6xl text-5xl font-bold leading-[0.98] tracking-tight text-white drop-shadow-sm sm:text-6xl lg:text-7xl"
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
          className="absolute inset-0 overflow-hidden"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, #6C5ED1 0%, #6C5ED1 30%, #C47FEF 55%, #C47FEF 100%)",
          }}
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
            className="relative w-full -translate-y-[28%] rounded-xl border border-black/10 shadow-2xl"
          />
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20"
          style={{
            backgroundImage: "url('/herobg1.png')",
            backgroundSize: "cover",
            backgroundPosition: "center bottom",
            backgroundRepeat: "no-repeat",
          }}
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

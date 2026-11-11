"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";

import { BrandLogo } from "@/components/brand-logo";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@letterstack.site";

export function Footer() {
  const reduceMotion = useReducedMotion();

  // fromX < 0 nudges in from the left edge, > 0 from the right.
  const handReveal = (fromX: number) => ({
    initial: reduceMotion ? undefined : { opacity: 0, scale: 0.92, x: fromX, y: 30 },
    whileInView: reduceMotion ? undefined : { opacity: 1, scale: 1, x: 0, y: 0 },
    viewport: { once: true, amount: 0.35 },
    transition: { duration: 0.85, ease: EASE_OUT },
  });

  return (
    <footer className="w-full bg-white pt-16 font-sans overflow-hidden">
      
      {/* ── Upper Footer Content ── */}
      <div className="mx-auto max-w-screen-xl px-6 lg:px-10">
        
        {/* ── Top Row: Logo & Socials ────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandLogo className="size-9 shrink-0" aria-hidden />
            <span className="text-sm font-semibold tracking-normal text-[#0A0A0A]">
              Letterstack
            </span>
          </Link>

        </div>

        {/* ── Upper Divider line (Dotted / Dashed) ───────────────────────── */}
        {/* <div className="w-full border-t border-dashed border-[#E4E4E7]" /> */}
      </div>

      {/* ── Mail Handoff Visual (Two hands + envelope) ── */}
      <div className="relative h-[180px] sm:h-[240px] md:h-[290px] lg:h-[340px] w-full overflow-hidden bg-white mt-8 mb-4">
        {/* Left hand */}
        <motion.div className="pointer-events-none absolute inset-0" {...handReveal(-22)}>
          <Image
            src="/visual-left-hand.png"
            alt=""
            width={686}
            height={388}
            className="absolute right-1/2 top-[46%] h-[160px] sm:h-[220px] md:h-[270px] lg:h-[320px] w-auto max-w-none -translate-x-[16%] -translate-y-1/2 select-none object-contain invert [mask-image:linear-gradient(to_right,transparent,black_25%)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_25%)]"
          />
        </motion.div>

        {/* Envelope */}
        <motion.div
          className="pointer-events-none absolute inset-0 z-10"
          initial={reduceMotion ? undefined : { opacity: 0, scale: 0.9 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.15 }}
        >
          <Image
            src="/visual-envelope.png"
            alt="Purple envelope"
            width={1536}
            height={1024}
            className="absolute left-1/2 top-[42%] w-28 -translate-x-1/2 -translate-y-1/2 rotate-[-7deg] select-none object-contain drop-shadow-2xl sm:w-36 md:w-48 lg:w-60"
          />
        </motion.div>

        {/* Right hand */}
        <motion.div className="pointer-events-none absolute inset-0" {...handReveal(22)}>
          <Image
            src="/visual-right-hand.png"
            alt=""
            width={704}
            height={376}
            className="absolute left-1/2 top-[63%] h-[160px] sm:h-[220px] md:h-[270px] lg:h-[320px] w-auto max-w-none translate-x-[16%] -translate-y-1/2 select-none object-contain invert [mask-image:linear-gradient(to_left,transparent,black_25%)] [-webkit-mask-image:linear-gradient(to_left,transparent,black_25%)]"
          />
        </motion.div>
      </div>

      {/* ── Lower Footer Content ── */}
      <div className="mx-auto max-w-screen-xl px-6 lg:px-10 pb-12">
        {/* ── Lower Divider line (Dotted / Dashed) ───────────────────────── */}
        <div className="w-full border-t border-dashed border-[#E4E4E7] mb-8" />

        {/* ── Bottom Row: Copyright & Status ─────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-xs text-[#717171]">
              © {new Date().getFullYear()} Letterstack
            </p>
            <Link
              href="/pricing"
              className="text-xs text-[#717171] underline-offset-4 transition-colors hover:text-[#0A0A0A] hover:underline"
            >
              Pricing
            </Link>
            {/* Google's OAuth review requires the privacy policy to be
                reachable from the homepage, so these live in the footer
                rather than only on the pages that reference them. */}
            <Link
              href="/privacy"
              className="text-xs text-[#717171] underline-offset-4 transition-colors hover:text-[#0A0A0A] hover:underline"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-xs text-[#717171] underline-offset-4 transition-colors hover:text-[#0A0A0A] hover:underline"
            >
              Terms
            </Link>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-xs text-[#717171] underline-offset-4 transition-colors hover:text-[#0A0A0A] hover:underline"
            >
              Contact
            </a>
          </div>

        </div>
      </div>

    </footer>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";

import { BrandLogo } from "@/components/brand-logo";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

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

          {/* Socials */}
          <div className="flex items-center gap-4 text-[#717171]">
            <Link href="https://x.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#0A0A0A] transition-colors" aria-label="X (Twitter)">
              <svg className="size-4 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </Link>
            <Link href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#0A0A0A] transition-colors" aria-label="LinkedIn">
              <svg className="size-4 fill-current" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z" />
              </svg>
            </Link>
          </div>
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
          <p className="text-xs text-[#717171]">
            © {new Date().getFullYear()} Letterstack
          </p>

          {/* Status Badge */}
          <div className="self-start flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#E4E4E7] bg-white shadow-xs text-[11px] font-medium text-[#0A0A0A] select-none">
            <span className="relative flex size-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full size-1.5 bg-emerald-500"></span>
            </span>
            All Systems Operational
          </div>
        </div>
      </div>

    </footer>
  );
}

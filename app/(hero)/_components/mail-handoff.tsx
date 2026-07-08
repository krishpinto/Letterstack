"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";

// The two-hands-passing-a-letter visual from the previous landing design:
// a left and right hand reaching in toward a tilted purple envelope, both
// index fingers pointing at it — Creation-of-Adam style. Purely decorative.
//
// The two hand PNGs are NOT symmetric: the left hand's fingertip sits near the
// vertical centre of its image, the right hand's near the top. So the hands are
// sized by height and anchored to the horizontal centre (keeps fingertips on
// the envelope at any screen width), and the right hand is pushed further down
// so its high fingertip drops to the same line as the left's.
//
// The source PNGs are low-res, so they're kept near their native size (crisp)
// rather than stretched edge-to-edge — the `top` values compensate for the
// smaller height so the fingertips stay locked on the letter. The outer arm
// ends, which no longer reach the screen edges, are faded out with a mask.
//
// On scroll-in, each hand eases up into place from slightly below, a touch
// smaller, and nudged outward toward its own edge — subtle depth, plays once.
// The animation transform lives on the wrapper so it can't collide with the
// image's own positioning transform.

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export function MailHandoff() {
  const reduceMotion = useReducedMotion();

  // fromX < 0 nudges in from the left edge, > 0 from the right.
  const handReveal = (fromX: number) => ({
    initial: reduceMotion ? undefined : { opacity: 0, scale: 0.92, x: fromX, y: 30 },
    whileInView: reduceMotion ? undefined : { opacity: 1, scale: 1, x: 0, y: 0 },
    viewport: { once: true, amount: 0.35 },
    transition: { duration: 0.85, ease: EASE_OUT },
  });

  return (
    <section className="mt-16 lg:mt-24">
      <div className="relative h-[320px] w-full overflow-hidden bg-background sm:h-[430px] md:h-[560px] lg:h-[700px]">
        {/* Left hand — right edge anchored at centre, finger reaching in from the
            left; outer (left) arm end faded out with a mask. */}
        <motion.div className="pointer-events-none absolute inset-0" {...handReveal(-22)}>
          <Image
            src="/visual-left-hand.png"
            alt=""
            width={686}
            height={388}
            className="absolute right-1/2 top-[54%] h-[63%] w-auto max-w-none -translate-x-[16%] -translate-y-1/2 select-none object-contain invert [mask-image:linear-gradient(to_right,transparent,black_25%)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_25%)]"
          />
        </motion.div>

        {/* Envelope — centred, tilted, floating between the fingertips */}
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
            className="absolute left-1/2 top-1/2 w-28 -translate-x-1/2 -translate-y-1/2 rotate-[-7deg] select-none object-contain drop-shadow-2xl sm:w-36 md:w-48 lg:w-60"
          />
        </motion.div>

        {/* Right hand — left edge anchored at centre, dropped down so its high
            fingertip lands on the envelope; outer (right) arm end faded with a mask. */}
        <motion.div className="pointer-events-none absolute inset-0" {...handReveal(22)}>
          <Image
            src="/visual-right-hand.png"
            alt=""
            width={704}
            height={376}
            className="absolute left-1/2 top-[71%] h-[63%] w-auto max-w-none translate-x-[16%] -translate-y-1/2 select-none object-contain invert [mask-image:linear-gradient(to_left,transparent,black_25%)] [-webkit-mask-image:linear-gradient(to_left,transparent,black_25%)]"
          />
        </motion.div>
      </div>
    </section>
  );
}

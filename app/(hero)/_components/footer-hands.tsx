"use client";

import Image from "next/image";
import { MotionConfig, motion } from "motion/react";

// The page's sign-off image: two hands passing a purple envelope. They ease
// into place once, the first time the band scrolls into view.
//
// A client component on its own so the rest of the footer (plain links) can
// stay a server component and ship no JavaScript.

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

// fromX < 0 nudges in from the left edge, > 0 from the right.
const handReveal = (fromX: number) => ({
  initial: { opacity: 0, scale: 0.92, x: fromX, y: 30 },
  whileInView: { opacity: 1, scale: 1, x: 0, y: 0 },
  viewport: { once: true, amount: 0.35 },
  transition: { duration: 0.85, ease: EASE_OUT },
});

export function FooterHands() {
  // reducedMotion="user": the same props render on server and client (no
  // hydration mismatch), and motion itself drops the movement for people who
  // ask their OS for reduced motion, keeping only the fade.
  return (
    <MotionConfig reducedMotion="user">
      <div
        aria-hidden="true"
        className="relative h-[200px] w-full sm:h-[260px] md:h-[300px] lg:h-[340px]"
      >
        <motion.div className="pointer-events-none absolute inset-0" {...handReveal(-22)}>
          <Image
            src="/visual-left-hand.png"
            alt=""
            width={686}
            height={388}
            sizes="(min-width: 1024px) 566px, (min-width: 640px) 390px, 283px"
            className="absolute right-1/2 top-[46%] h-[160px] w-auto max-w-none -translate-x-[16%] -translate-y-1/2 select-none object-contain invert [mask-image:linear-gradient(to_right,transparent,black_25%)] sm:h-[220px] md:h-[270px] lg:h-[320px]"
          />
        </motion.div>

        <motion.div
          className="pointer-events-none absolute inset-0 z-10"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.15 }}
        >
          <Image
            src="/visual-envelope.webp"
            alt=""
            width={640}
            height={427}
            sizes="(min-width: 1024px) 224px, (min-width: 768px) 192px, 144px"
            className="absolute left-1/2 top-[42%] w-28 -translate-x-1/2 -translate-y-1/2 rotate-[-7deg] select-none object-contain drop-shadow-2xl sm:w-36 md:w-48 lg:w-56"
          />
        </motion.div>

        <motion.div className="pointer-events-none absolute inset-0" {...handReveal(22)}>
          <Image
            src="/visual-right-hand.png"
            alt=""
            width={704}
            height={376}
            sizes="(min-width: 1024px) 600px, (min-width: 640px) 412px, 300px"
            className="absolute left-1/2 top-[63%] h-[160px] w-auto max-w-none translate-x-[16%] -translate-y-1/2 select-none object-contain invert [mask-image:linear-gradient(to_left,transparent,black_25%)] sm:h-[220px] md:h-[270px] lg:h-[320px]"
          />
        </motion.div>
      </div>
    </MotionConfig>
  );
}

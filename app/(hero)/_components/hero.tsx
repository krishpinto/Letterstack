import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { StartCtaLink } from "@/components/start-cta";

import { Meadow } from "./hero-scene/meadow";
import { button, displayFont } from "./landing-ui";

// The hero: the meadow in daylight (see hero-scene/meadow.tsx). Its white sky
// runs straight into the white navbar above it, so the page opens as one
// surface, with the copy in the sky and the hills along the bottom. The
// product preview that follows is pulled up over the foot of the hills.

export function Hero() {
  return (
    <Meadow
      time="day"
      data-hero-section
      className="h-[clamp(560px,calc(100svh-8rem),760px)]"
    >
      <div className="flex h-full flex-col items-center px-6 pt-[clamp(56px,9svh,96px)] text-center">
        <h1
          className="max-w-4xl text-balance text-4xl font-semibold leading-[1.04] tracking-tight text-neutral-950 sm:text-6xl lg:text-[4.25rem]"
          style={displayFont}
        >
          Newsletters for clubs, councils and charities.
        </h1>
        <p className="mt-5 max-w-lg text-pretty text-base leading-relaxed text-neutral-600 sm:text-lg">
          Design your newsletter in blocks, send it from your own domain, and
          see what happened to every email.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <StartCtaLink className={button.primary}>
            <ArrowRightIcon className="size-4" aria-hidden />
          </StartCtaLink>
          <Link href="/#product" className={button.secondary}>
            See the product
          </Link>
        </div>
      </div>
    </Meadow>
  );
}

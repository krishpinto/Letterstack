import { ArrowRightIcon } from "lucide-react";

import { StartCtaLink } from "@/components/start-cta";

import { ContactSalesScreen } from "../contact-sales-screen";
import { Frame } from "../frame";
import { button, displayFont } from "../landing-ui";

// The closing call to action. It stays light, like the rest of the page: the
// headline and buttons on white, with a soft lavender glow behind them (the
// hero sky's colour, much fainter).
//
// It has no line under it on purpose. The footer's hands-and-envelope band
// comes straight after, so the two read as one section: the pitch, then the
// hand-off.

export function FinalCta() {
  return (
    <Frame
      id="contact"
      last
      className="relative overflow-hidden"
      innerClassName="relative px-6 pb-6 pt-20 sm:pb-10 sm:pt-28"
    >
      {/* Wider than the column, so the glow carries past the side rails and
          fades out in the margins. Clipped by the section. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-full w-screen -translate-x-1/2"
        style={{
          background:
            "radial-gradient(ellipse 46% 62% at 50% 42%, rgba(185,170,246,0.34), rgba(220,211,255,0.14) 55%, transparent 78%)",
        }}
      />

      <div className="relative flex flex-col items-center text-center">
        <h2
          className="max-w-3xl text-balance text-4xl font-semibold leading-[1.04] tracking-tight text-neutral-950 sm:text-6xl"
          style={displayFont}
        >
          Send your next newsletter from your own domain.
        </h2>
        <p className="mt-5 max-w-md text-pretty text-base leading-relaxed text-neutral-600 sm:text-lg">
          Start on the free plan. Bring your list, connect your domain and
          send when you are ready.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <StartCtaLink className={button.primary}>
            <ArrowRightIcon className="size-4" aria-hidden />
          </StartCtaLink>
          <ContactSalesScreen />
        </div>
      </div>
    </Frame>
  );
}

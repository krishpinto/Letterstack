"use client";

import { useRouter } from "next/navigation";
import { ArrowRightIcon, MailIcon, SendIcon } from "lucide-react";

import { Marquee } from "@/components/ui/marquee";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { cn } from "@/lib/utils";

// What's actually true about sending through Letterstack, not a features
// list — the on/off framing makes the trade-offs explicit rather than
// selling them. Every line here has to be something we'd stand behind if a
// prospect checked it, since the platform has one real beta client so far.
const CLAIMS: Array<{ label: string; on: boolean }> = [
  { label: "Real HTML, not a flattened image", on: true },
  { label: "Vendor lock-in", on: false },
  { label: "Send from your own domain", on: true },
  { label: "Gmail clipping your layout", on: false },
  { label: "Amazon SES pricing, no markup", on: true },
  { label: "Hidden per-seat fees", on: false },
  { label: "Bounce & suppression handling", on: true },
  { label: "Manual list cleanup", on: false },
];

function ClaimPill({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-2.5 rounded-full bg-[#EFEFF0] py-1.5 pr-1.5 pl-3.5">
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          on ? "bg-[#9CAF6B]" : "bg-[#D9A55B]",
        )}
      />
      <span className="font-mono text-sm whitespace-nowrap text-[#0A0A0A]">
        {label}
      </span>
      <span className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold whitespace-nowrap text-[#0A0A0A]">
        {on ? "On" : "Off"}
      </span>
    </div>
  );
}

function EdgeMark({ icon: Icon, side }: { icon: typeof MailIcon; side: "top" | "bottom" }) {
  return (
    <div
      className={cn(
        "absolute left-1/2 z-10 flex size-10 -translate-x-1/2 items-center justify-center rounded-full border border-[#E4E4E7] bg-white shadow-xs",
        side === "top" ? "top-0 -translate-y-1/2" : "bottom-0 translate-y-1/2",
      )}
    >
      <Icon className="size-4 text-[#717171]" />
    </div>
  );
}

const HEADING_FONT = { fontFamily: "var(--font-bricolage, var(--font-inter))" };

export function TrustSection() {
  const router = useRouter();

  return (
    <section id="contact" className="scroll-mt-24 py-24 sm:py-28">
      <div className="mx-auto max-w-screen-xl px-6 lg:px-10">
        <div className="relative rounded-3xl border-2 border-dotted border-[#C7C7CC] px-6 py-16 sm:px-10 sm:py-20">
          <EdgeMark icon={MailIcon} side="top" />

          <div className="flex flex-col items-center gap-8 text-center">
            <h2
              className="max-w-2xl text-4xl font-bold leading-[1.1] tracking-tight text-[#0A0A0A] sm:text-5xl lg:text-6xl"
              style={HEADING_FONT}
            >
              Real email,
            </h2>

            <div className="relative -mx-6 w-[calc(100%+3rem)] overflow-hidden py-1 sm:-mx-10 sm:w-[calc(100%+5rem)]">
              <Marquee pauseOnHover className="[--duration:70s] [--gap:0.75rem]">
                {CLAIMS.map((claim) => (
                  <ClaimPill key={claim.label} {...claim} />
                ))}
              </Marquee>

              <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-1/6 bg-gradient-to-r from-white to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-1/6 bg-gradient-to-l from-white to-transparent" />
            </div>

            <h2
              className="max-w-2xl text-4xl font-bold leading-[1.1] tracking-tight text-[#0A0A0A] sm:text-5xl lg:text-6xl"
              style={HEADING_FONT}
            >
              sent the way you actually built it.
            </h2>

            <p className="max-w-xl text-lg leading-relaxed text-[#717171]">
              No flattened screenshots, no clipped layouts, no per-seat pricing
              tricks — what you design is exactly what lands in the inbox,
              sent from a domain you own.
            </p>

            <ShimmerButton
              onClick={() => router.push("/signup")}
              background="#5D5FEF"
              className="mt-2 gap-1.5 px-8 py-3 text-sm font-semibold"
            >
              Join the waitlist
              <ArrowRightIcon className="size-4" />
            </ShimmerButton>
          </div>

          <EdgeMark icon={SendIcon} side="bottom" />
        </div>
      </div>
    </section>
  );
}

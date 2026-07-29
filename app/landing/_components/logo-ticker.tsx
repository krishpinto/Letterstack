"use client";

const BRANDS = [
  "Stripe",
  "Shopify",
  "Linear",
  "Vercel",
  "Figma",
  "Framer",
  "Notion",
  "Loom",
  "Intercom",
  "Retool",
  "PostHog",
  "Railway",
  "Cal.com",
  "Fly.io",
  "Trigger.dev",
  "Resend",
];

// Duplicate the list so the second half starts exactly where the first ends —
// the CSS animation translates by -50% creating a seamless infinite loop.
const ITEMS = [...BRANDS, ...BRANDS];

export function LogoTicker() {
  return (
    <section
      aria-label="Trusted by"
      className="relative overflow-hidden border-y border-[#E4E4E7] py-7"
    >
      {/* Gradient fade masks on both edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-28 bg-gradient-to-r from-white to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-28 bg-gradient-to-l from-white to-transparent"
      />

      {/* Scrolling strip — pause on hover */}
      <div
        className="flex items-center gap-14 hover:[animation-play-state:paused]"
        style={{
          width: "max-content",
          animation: "marquee 40s linear infinite",
        }}
      >
        {ITEMS.map((name, i) => (
          <span
            key={i}
            className="select-none whitespace-nowrap text-base font-semibold text-[#0A0A0A] opacity-40 transition-opacity hover:opacity-80"
          >
            {name}
          </span>
        ))}
      </div>
    </section>
  );
}

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

// ─── Mini product mockup (dark Letterstack dashboard) ────────────────────────

const BAR_HEIGHTS = [38, 58, 42, 72, 46, 84, 60, 68, 50, 80, 44, 92, 58, 76];

function StatCard({
  label,
  value,
  trend,
  trendColor,
}: {
  label: string;
  value: string;
  trend: string;
  trendColor: string;
}) {
  return (
    <div className="flex-1 min-w-0 rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-2.5">
      <p className="truncate text-[9px] uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-white sm:text-base">{value}</p>
      <p className={cn("mt-0.5 text-[9px]", trendColor)}>{trend}</p>
    </div>
  );
}

function ProductMockup() {
  const navItems = [
    "Dashboard",
    "Campaigns",
    "Analytics",
    "Subscribers",
    "Templates",
    "Domains",
  ];

  return (
    <div className="w-full select-none overflow-hidden rounded-xl bg-[#0A0A0A] font-sans shadow-2xl">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-white/[0.07] bg-[#141414] px-4 py-2.5">
        <div className="flex shrink-0 gap-1.5">
          <span className="size-2.5 rounded-full bg-[#FF5F57]" />
          <span className="size-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="size-2.5 rounded-full bg-[#28C840]" />
        </div>
        <div className="flex flex-1 justify-center">
          <div className="rounded-md bg-white/[0.06] px-4 py-1 font-mono text-[10px] text-white/30">
            app.letterstack.io/dashboard/analytics
          </div>
        </div>
      </div>

      {/* App layout */}
      <div className="flex h-[300px] sm:h-[380px] lg:h-[440px]">
        {/* Sidebar — hidden on the smallest screens */}
        <aside className="hidden w-[152px] shrink-0 flex-col border-r border-white/[0.06] bg-[#0D0D0D] sm:flex">
          {/* Workspace header */}
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-3">
            <div className="flex size-5 items-center justify-center rounded-md bg-white text-[9px] font-black text-black">
              L
            </div>
            <span className="text-[11px] font-semibold text-white/80">Letterstack</span>
          </div>

          {/* Nav */}
          <nav className="flex flex-col gap-0.5 p-2">
            {navItems.map((item) => (
              <div
                key={item}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-[11px]",
                  item === "Analytics"
                    ? "bg-white/[0.08] font-medium text-white"
                    : "text-white/35",
                )}
              >
                {item}
              </div>
            ))}
          </nav>

          <div className="mt-auto border-t border-white/[0.06] p-2">
            <div className="px-2.5 py-1.5 text-[11px] text-white/25">Settings</div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden bg-[#0A0A0A] p-3 sm:p-4 lg:p-5">
          {/* Page header */}
          <div className="flex shrink-0 items-center justify-between">
            <div>
              <h3 className="text-[13px] font-semibold text-white">Analytics</h3>
              <p className="text-[10px] text-white/35">Last 30 days</p>
            </div>
            <div className="rounded-md bg-white/[0.07] px-2 py-1 text-[10px] text-white/40">
              Jul 1 – Jul 31
            </div>
          </div>

          {/* Stat cards */}
          <div className="flex shrink-0 gap-2">
            <StatCard label="Delivered" value="124k"  trend="↑ 8.2%"  trendColor="text-emerald-400" />
            <StatCard label="Opened"    value="48.2k" trend="↑ 12.1%" trendColor="text-emerald-400" />
            <StatCard label="Clicked"   value="9.8k"  trend="↑ 4.7%"  trendColor="text-blue-400"   />
          </div>

          {/* Bar chart */}
          <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-white/[0.06] bg-white/[0.04] p-3">
            <div className="mb-2 flex shrink-0 items-center justify-between">
              <span className="text-[10px] font-medium text-white/60">
                Overall sends · Jul 2026
              </span>
            </div>
            <div className="flex min-h-0 flex-1 items-end gap-1">
              {BAR_HEIGHTS.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{
                    height: `${h}%`,
                    backgroundColor:
                      i === 11
                        ? "rgba(255,255,255,0.55)"
                        : "rgba(255,255,255,0.11)",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Bottom metric row */}
          <div className="flex shrink-0 gap-2">
            {[
              { label: "Bounce rate", value: "0.08%", badge: "Excellent", color: "bg-emerald-400", text: "text-emerald-400" },
              { label: "Click rate",  value: "7.9%",  badge: "Above avg", color: "bg-blue-400",    text: "text-blue-400"   },
              { label: "Spam rate",   value: "0.01%", badge: "Safe",      color: "bg-emerald-400", text: "text-emerald-400" },
            ].map(({ label, value, badge, color, text }) => (
              <div
                key={label}
                className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-2"
              >
                <p className="text-[9px] text-white/40">{label}</p>
                <p className="text-sm font-bold text-white">{value}</p>
                <div className="mt-0.5 flex items-center gap-1">
                  <span className={cn("size-1.5 rounded-full", color)} />
                  <span className={cn("text-[9px]", text)}>{badge}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hero section ─────────────────────────────────────────────────────────────

export function Hero() {
  return (
    <section data-hero-section className="pb-0 pt-20 lg:pt-28">
      <div className="mx-auto max-w-screen-xl px-6 lg:px-10 mb-2">

        {/* ── Heading row ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-6">
          {/* Headline */}
          <h1
            className="max-w-[85%] text-[2.6rem] font-bold leading-[1] tracking-tight text-foreground sm:text-6xl lg:max-w-[72%] lg:text-[5rem]"
            style={{ fontFamily: "var(--font-bricolage, var(--font-inter))" }}
          >
            The email delivery
            <br />
            platform for teams
            <br />
            that actually ship.
          </h1>

        </div>

        {/* ── Subtitle ──────────────────────────────────────────────────── */}
        <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
          Purpose-built for transactional and marketing email. Set up in minutes,
          scale to billions.
        </p>


        {/* ── CTAs ──────────────────────────────────────────────────────── */}
        <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <Button size="lg" asChild>
            <Link href="/signup">
              Get started free
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        </div>

        {/* ── Product mockup in muted container ─────────────────────────── */}
        <div className="mt-14 rounded-2xl border border-border/40 bg-muted/50 lg:mt-16">
          {/* Inner: herobg.png frames bottom, mockup floats on top */}
          <div
            className="rounded-xl overflow-hidden"
            style={{
              backgroundImage: "url('/herobg.png')",
              backgroundSize: "100% auto",
              backgroundPosition: "center bottom",
              backgroundRepeat: "no-repeat",
            }}
          >
            <div className="p-12">
              {/* <ProductMockup /> */}
              <Image
                src="/image-hero.png"
                alt="Product Mockup"
                width={800}
                height={450}
                className="w-full h-auto rounded-lg shadow-2xl border border-muted/40"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

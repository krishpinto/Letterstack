import { Hero } from "./_components/hero";
import { LogoTicker } from "./_components/logo-ticker";
import { Features } from "./_components/features";
import { ReplaceSection } from "./_components/replace";
import { FounderTestimonials } from "./_components/founder-testimonials";
import { PipelineSection } from "./_components/pipeline";
import { Stats } from "./_components/stats";
import { Testimonials } from "./_components/testimonials";
import { MailHandoff } from "./_components/mail-handoff";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <Hero />

      {/* ── Logo ticker ─────────────────────────────────────────────────── */}
      <LogoTicker />

      {/* ── Features ────────────────────────────────────────────────────── */}
      <Features />

      {/* ── Replace Section ──────────────────────────────────────────────── */}
      <ReplaceSection />

      {/* ── Founder Testimonials ─────────────────────────────────────────── */}
      <FounderTestimonials />

      {/* ── Pipeline Section ─────────────────────────────────────────────── */}
      <PipelineSection />

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <Stats />

      {/* ── Testimonials ────────────────────────────────────────────────── */}
      <Testimonials />

      {/* ── Mail hand-off visual (two hands + envelope) ─────────────────── */}
      <MailHandoff />
    </div>
  );
}

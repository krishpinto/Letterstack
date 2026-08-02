import { Hero } from "./_components/hero";
import { Features } from "./_components/features";
import { ReplaceSection } from "./_components/replace";
import { FounderTestimonials } from "./_components/founder-testimonials";
import { PipelineSection } from "./_components/pipeline";
import { TrustSection } from "./_components/trust-marquee";
import { Footer } from "./_components/footer";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <Hero />
      <Features />
      <ReplaceSection />
      <PipelineSection />
      <FounderTestimonials />
      <TrustSection />

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <Footer />
    </div>
  );
}

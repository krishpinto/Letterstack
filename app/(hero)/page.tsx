import { Hero } from "./_components/hero";
import { LogoTicker } from "./_components/logo-ticker";
import { Features } from "./_components/features";
import { ReplaceSection } from "./_components/replace";
import { FounderTestimonials } from "./_components/founder-testimonials";
import { PipelineSection } from "./_components/pipeline";
import { Stats } from "./_components/stats";
import { Testimonials } from "./_components/testimonials";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <Hero />
      <LogoTicker />
      <Features />
      <ReplaceSection />
      <FounderTestimonials />
      <PipelineSection />
      <Stats />
      <Testimonials />
    </div>
  );
}
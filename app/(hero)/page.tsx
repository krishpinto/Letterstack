import type { Metadata } from "next";

import { Hero } from "./_components/hero";
import { ProductPreview } from "./_components/product-preview";
import { Features } from "./_components/sections/features";
import { PricingPreview } from "./_components/sections/pricing-preview";
import { Faq } from "./_components/sections/faq";
import { FinalCta } from "./_components/sections/final-cta";
import { Footer } from "./_components/footer";

export const metadata: Metadata = {
  title: "LetterStack: newsletters for clubs, councils and charities",
  description:
    "Design a newsletter in blocks, send it from your own domain through Amazon SES, and see what happened to every email. Free to start.",
};

// The landing page, top to bottom. Every section is a <Frame> (see
// _components/frame.tsx) built from the pieces in _components/landing-ui.tsx.
export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <Hero />
      <ProductPreview />
      <Features />
      <PricingPreview />
      <Faq />
      <FinalCta />
      <Footer />
    </div>
  );
}

import type { Metadata } from "next";

import { Pricing02 } from "@/components/pricing-02";
import { Footer } from "../_components/footer";

// Lives inside the (hero) route group — the URL is still /pricing, but it
// now inherits the marketing shell, so the page has the navbar people used
// to get here. As its own top-level route it rendered with no nav and no
// footer at all, which made it a dead end.
export const metadata: Metadata = {
  title: "Pricing — LetterStack",
  description:
    "Plans sized by contacts, not send volume. Free to start, ₹499/month for a few thousand subscribers, and a Business tier for high-volume senders.",
};

export default function PricingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <Pricing02 />
      <Footer />
    </div>
  );
}

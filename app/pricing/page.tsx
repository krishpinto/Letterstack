import type { Metadata } from "next";

import { Pricing02 } from "@/components/pricing-02";

export const metadata: Metadata = {
  title: "Pricing — LetterStack",
  description:
    "Plans sized by contacts, not send volume. Free to start, ₹499/month for a few thousand subscribers.",
};

export default function PricingPage() {
  return <Pricing02 />;
}

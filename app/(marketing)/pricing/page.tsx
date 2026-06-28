import Link from "next/link";

import { Section } from "@/components/section";
import { SectionHeading } from "@/components/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Starter",
    price: "$0",
    detail: "For testing templates and small sends.",
    cta: "Start free",
    featured: false,
    items: ["Visual editor", "Template library", "Manual campaign sends"],
  },
  {
    name: "Growth",
    price: "$29",
    detail: "For teams sending regular campaigns.",
    cta: "Choose Growth",
    featured: true,
    items: ["Own-domain sending", "Campaign tracking", "Suppression lists"],
  },
  {
    name: "Scale",
    price: "Custom",
    detail: "For higher volume and operational support.",
    cta: "Contact us",
    featured: false,
    items: ["Dedicated setup", "Deliverability review", "Priority support"],
  },
] as const;

export default function PricingPage() {
  return (
    <>
      <Section>
        <SectionHeading
          label="Pricing"
          heading="Simple pricing for teams that want to own their sending."
          subheading="Start with the editor, then connect verified sending when your campaigns are ready."
        />

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className="flex rounded-lg border border-border bg-background p-6 shadow-sm"
            >
              <div className="flex min-h-[360px] w-full flex-col">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold tracking-normal">
                    {plan.name}
                  </h2>
                  {plan.featured && <Badge>Popular</Badge>}
                </div>
                <div className="mt-6 text-4xl font-semibold tracking-normal">
                  {plan.price}
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {plan.detail}
                </p>
                <div className="mt-6 flex flex-col gap-3 text-sm text-muted-foreground">
                  {plan.items.map((item) => (
                    <div key={item} className="rounded-md bg-muted/40 px-3 py-2">
                      {item}
                    </div>
                  ))}
                </div>
                <Button
                  className="mt-auto"
                  variant={plan.featured ? "default" : "outline"}
                  asChild
                >
                  <Link href={plan.name === "Scale" ? "/contact" : "/dashboard"}>
                    {plan.cta}
                  </Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      </Section>
    </>
  );
}

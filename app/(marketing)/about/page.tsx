import Link from "next/link";

import { Section } from "@/components/section";
import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";

const values = [
  "Portable HTML over platform lock-in",
  "Own-domain sending as the default",
  "Campaign tools that stay fast under pressure",
] as const;

export default function AboutPage() {
  return (
    <>
      <Section>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <SectionHeading
            label="About"
            heading="LetterStack is built for teams that want control without busywork."
            subheading="The product pairs a visual email editor with sending infrastructure so marketers can move quickly while engineering keeps the domain and deliverability setup clean."
            align="left"
          />

          <div className="grid gap-4">
            {values.map((value, index) => (
              <div
                key={value}
                className="rounded-lg border border-border bg-background p-5 shadow-sm"
              >
                <div className="text-sm font-medium text-primary">
                  0{index + 1}
                </div>
                <div className="mt-3 text-xl font-semibold tracking-normal">
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-wrap gap-3">
          <Button size="lg" asChild>
            <Link href="/features">Explore features</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/contact">Contact us</Link>
          </Button>
        </div>
      </Section>
    </>
  );
}

import Link from "next/link";

import { Section } from "@/components/section";
import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";

const features = [
  {
    title: "Visual HTML canvas",
    body: "Build responsive campaigns from reusable rows, sections, text, images, and buttons without flattening the email into one image.",
  },
  {
    title: "Reusable templates",
    body: "Keep campaign-ready layouts for newsletters, launches, promos, and lifecycle updates in one workspace.",
  },
  {
    title: "Own-domain sending",
    body: "Send through verified SPF, DKIM, and DMARC records so campaigns arrive from your brand, not a rented sender.",
  },
  {
    title: "Campaign control center",
    body: "Track recipients, opens, clicks, suppressions, and send progress from the same place you create campaigns.",
  },
] as const;

export default function FeaturesPage() {
  return (
    <>
      <Section>
        <SectionHeading
          label="Features"
          heading="Everything you need to create, send, and track bulk email."
          subheading="A focused stack for teams that want a visual editor, affordable sending, and ownership of their email infrastructure."
        />

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {features.map((feature, index) => (
            <article
              key={feature.title}
              className="rounded-lg border border-border bg-background p-5 shadow-sm"
            >
              <div className="mb-5 flex h-28 items-end gap-2 rounded-md bg-muted/40 p-3">
                {[42, 68, 52, 84, 64].map((height, barIndex) => (
                  <div
                    key={barIndex}
                    className="flex-1 rounded-t-md bg-primary/70"
                    style={{
                      height: `${Math.max(20, height - index * 6)}%`,
                    }}
                  />
                ))}
              </div>
              <h2 className="text-xl font-semibold tracking-normal">
                {feature.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {feature.body}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Button size="lg" asChild>
            <Link href="/design">Design a campaign</Link>
          </Button>
        </div>
      </Section>
    </>
  );
}

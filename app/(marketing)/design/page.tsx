import Image from "next/image";
import Link from "next/link";

import { Section } from "@/components/section";
import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";

const templateTypes = ["Newsletter", "Launch", "Promo", "Lifecycle"];

export default function DesignPage() {
  return (
    <>
      <Section className="[&>div>div:last-child]:py-0">
        <div className="grid min-h-[calc(100svh-56px)] items-center gap-10 py-24 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <SectionHeading
              label="Design"
              heading="Design polished campaigns on a visual HTML canvas."
              subheading="Compose reusable email sections, preview responsive layouts, and keep the final HTML portable."
              align="left"
            />
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/editor">Open editor</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/features">See features</Link>
              </Button>
            </div>
          </div>

          <div className="relative min-h-[360px] overflow-hidden rounded-lg border border-border bg-muted/30 shadow-sm">
            <Image
              src="/herobg.png"
              alt=""
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover object-left-bottom opacity-70"
              priority
            />
            <div className="absolute inset-6 rounded-lg border border-border bg-background/90 p-4 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <div className="text-xs font-medium uppercase text-muted-foreground">
                    Template builder
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    Spring campaign
                  </div>
                </div>
                <div className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  HTML
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {templateTypes.map((template) => (
                  <div
                    key={template}
                    className="rounded-lg border border-border bg-background p-3"
                  >
                    <div className="aspect-[4/3] rounded-md bg-muted" />
                    <div className="mt-3 h-2 rounded-full bg-foreground/80" />
                    <div className="mt-2 h-2 w-2/3 rounded-full bg-muted" />
                    <div className="mt-3 text-xs text-muted-foreground">
                      {template}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}

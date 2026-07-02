import { Section } from "@/components/section";
import { SectionHeading } from "@/components/section-heading";
import { DivHeading } from "@/components/div-heading";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { ProgressiveBlur } from "@/components/progressive-blur";
import { cn } from "@/lib/utils";
import { LetterCascade } from "@/components/ui/letter-cascade";
import { RichButton } from "@/components/rich-button";

const featureOverviewCards = [
  {
    title: "Design campaigns with a visual HTML canvas",
    description:
      "Create polished campaigns with reusable blocks, responsive previews, and portable HTML.",
  },
  {
    title: "Launch faster with prebuilt templates",
    description:
      "Start from campaign-ready layouts for newsletters, launches, promos, and lifecycle emails.",
  },
  {
    title: "Send from your own verified domain",
    description:
      "Connect SPF, DKIM, and DMARC once, then send affordable bulk email from your brand.",
  },
  {
    title: "Track every campaign from one dashboard",
    description:
      "Monitor recipients, opens, clicks, and cost so your team knows what is working.",
  },
] as const;

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <Section id="hero" className="[&>div>div:last-child]:py-0">
        {/* Hero content above the background */}
          <div className="relative z-10 flex min-h-[82svh] max-w-4xl flex-col items-start justify-start pt-16 pb-[26svh] sm:min-h-[88svh] sm:pt-20 sm:pb-[30svh] md:min-h-svh md:pt-28 md:pb-[40svh] lg:justify-center lg:pt-24 lg:pb-[34svh]">

          <h1 className="max-w-4xl pb-2 text-4xl font-semibold leading-[1.12] tracking-normal sm:text-5xl md:text-6xl lg:text-7xl">
            <LetterCascade
              text="Send bulk HTML email from your own domain."
              className="flex flex-wrap justify-start text-left"
            />
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:mt-6 md:text-xl md:leading-8">
            LetterStack gives teams a visual campaign editor, reusable
            templates, and affordable sending without Mailchimp-style lock-in.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <RichButton color="primary" size="lg" asChild>
              <Link href="/signup">Start Building</Link>
            </RichButton>
            <Button size="lg" variant="outline" asChild>
              <Link href="/design">Explore Templates</Link>
            </Button>
          </div>
        </div>

        {/* Hero background image */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[34svh] min-h-[250px] max-h-[560px] overflow-hidden select-none sm:h-[38svh] md:h-[42svh] lg:h-[44svh]">
          <Image
            src="/herobg.png"
            alt=""
            fill
            sizes="100vw"
            className="origin-bottom scale-[2.35] object-cover object-left-bottom sm:scale-[1.75] sm:object-bottom md:scale-100"
            priority
          />
        </div>
        <ProgressiveBlur
          className="h-12 sm:h-16 md:block"
          position="bottom"
          height="clamp(48px, 8svh, 150px)"
          full
        />
      </Section>



      <Section id="features">
        <SectionHeading
          label="Feature Overview"
          heading={
            <>
              Create, send, and track
              <br />
              bulk email from your domain.
            </>
          }
          subheading="A visual HTML campaign builder with sending built in."
        />


        <div className="relative mx-auto mt-12 max-w-3xl overflow-hidden rounded-lg border border-border bg-background shadow-sm [mask-image:linear-gradient(to_bottom,black_74%,transparent_100%)]">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="size-2.5 rounded-full bg-primary/70" />
              <div className="size-2.5 rounded-full bg-accent" />
              <div className="size-2.5 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="hidden rounded-md border border-border bg-background px-3 py-1 text-xs text-muted-foreground sm:block">
              campaign.letterstack.app
            </div>
            <div className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
              Ready to send
            </div>
          </div>

          <div className="grid min-h-[300px] grid-cols-1 bg-muted/20 md:grid-cols-[150px_minmax(0,1fr)]">
            <aside className="border-b border-border bg-background p-3 lg:border-b-0 lg:border-r">
              <div className="text-sm font-semibold">LetterStack</div>
              <div className="mt-4 flex flex-col gap-1.5">
                {["Campaigns", "Templates", "Audience", "Domains"].map(
                  (item, index) => (
                    <div
                      key={item}
                      className={cn(
                        "rounded-md px-3 py-2 text-sm",
                        index === 0
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {item}
                    </div>
                  )
                )}
              </div>

              <div className="mt-5 rounded-lg border border-border bg-muted/30 p-2.5">
                <div className="text-xs font-medium uppercase text-muted-foreground">
                  Sender domain
                </div>
                <div className="mt-2 text-sm font-semibold">acme.com</div>
                <div className="mt-3 h-2 rounded-full bg-muted">
                  <div className="h-2 w-4/5 rounded-full bg-primary" />
                </div>
                <div className="mt-2 text-xs text-muted-foreground">Verified</div>
              </div>
            </aside>

            <main className="flex flex-col gap-3 p-3">
              <div className="flex flex-col justify-between gap-3 rounded-lg border border-border bg-background p-3 md:flex-row md:items-center">
                <div>
                  <div className="text-xs font-medium uppercase text-muted-foreground">
                    Canvas editor
                  </div>
                  <div className="mt-1 text-lg font-semibold">
                    Spring launch
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-md border border-border px-2 py-1">
                    Desktop
                  </span>
                  <span className="rounded-md border border-border px-2 py-1">
                    Mobile
                  </span>
                  <span className="rounded-md bg-primary px-2 py-1 font-medium text-primary-foreground">
                    Preview
                  </span>
                </div>
              </div>

              <div className="grid flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_170px]">
                <div className="rounded-lg border border-border bg-background p-3">
                  <div className="mx-auto max-w-sm overflow-hidden rounded-lg border border-border">
                    <div className="bg-primary/10 px-4 py-4 text-center">
                      <div className="mx-auto h-2.5 w-20 rounded-full bg-primary/30" />
                      <div className="mx-auto mt-4 h-6 w-48 rounded-md bg-foreground/90" />
                      <div className="mx-auto mt-3 h-2.5 w-56 max-w-full rounded-full bg-muted-foreground/25" />
                      <div className="mx-auto mt-2 h-2.5 w-40 rounded-full bg-muted-foreground/20" />
                      <div className="mx-auto mt-4 h-8 w-28 rounded-md bg-primary" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 bg-background p-3">
                      <div className="aspect-[4/3] rounded-md bg-muted" />
                      <div className="aspect-[4/3] rounded-md bg-muted" />
                      <div className="col-span-2 h-2.5 rounded-full bg-muted" />
                      <div className="col-span-2 h-2.5 w-4/5 rounded-full bg-muted" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
                  {[
                    ["Recipients", "84K"],
                    ["Cost", "$18"],
                    ["Open rate", "41.8%"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-lg border border-border bg-background p-3"
                    >
                      <div className="text-xs text-muted-foreground">{label}</div>
                      <div className="mt-1 text-lg font-semibold">{value}</div>
                    </div>
                  ))}
                  <div className="rounded-lg border border-border bg-primary/10 p-3">
                    <div className="text-sm font-semibold">Own domain</div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Portable templates and sending in one workspace.
                    </p>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </Section>

      <Section id="feature-grid">
        <div className="-mx-8 -my-16 grid grid-cols-1 md:-mx-16 md:-my-24 md:grid-cols-2">
          {featureOverviewCards.map((feature, index) => (
            <div
              key={feature.title}
              className={cn(
                "flex aspect-square min-h-0 flex-col justify-between overflow-hidden border-border p-6 md:p-8 lg:p-9",
                index < 2 && "border-b",
                index % 2 === 0 && "md:border-r"
              )}
            >
              <div className="flex h-[46%] min-h-0 shrink-0 items-center justify-center">
                {index === 0 && (
                  <div className="w-full max-w-sm overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                    <div className="flex items-center justify-between border-b border-border px-3 py-2">
                      <div className="text-xs font-semibold">Email canvas</div>
                      <div className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                        HTML
                      </div>
                    </div>
                    <div className="bg-muted/30 p-3">
                      <div className="rounded-lg border border-border bg-background p-4 text-center">
                        <div className="mx-auto h-2.5 w-16 rounded-full bg-primary/30" />
                        <div className="mx-auto mt-4 h-6 w-40 rounded-md bg-foreground/90" />
                        <div className="mx-auto mt-3 h-2.5 w-52 max-w-full rounded-full bg-muted-foreground/25" />
                        <div className="mx-auto mt-2 h-2.5 w-36 rounded-full bg-muted-foreground/20" />
                        <div className="mx-auto mt-4 h-7 w-24 rounded-md bg-primary" />
                      </div>
                    </div>
                  </div>
                )}

                {index === 1 && (
                  <div className="grid w-full max-w-sm grid-cols-2 gap-2">
                    {["Newsletter", "Launch", "Promo", "Lifecycle"].map(
                      (template) => (
                        <div
                          key={template}
                          className="rounded-xl border border-border bg-background p-2.5 shadow-sm"
                        >
                          <div className="aspect-[4/3] rounded-lg bg-muted" />
                          <div className="mt-2 h-2 w-4/5 rounded-full bg-foreground/80" />
                          <div className="mt-1.5 h-2 w-3/5 rounded-full bg-muted" />
                          <div className="mt-2 text-xs text-muted-foreground">
                            {template}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}

                {index === 2 && (
                  <div className="w-full max-w-sm">
                    <div className="ml-auto w-fit rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                      Domain verified
                    </div>
                    <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-background p-3 shadow-sm">
                      <div>
                        <div className="text-base font-semibold">acme.com</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          SPF, DKIM, DMARC
                        </div>
                      </div>
                      <div className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                        Primary
                      </div>
                    </div>
                    <div className="mt-3 ml-8 rounded-xl border border-border bg-background p-3 shadow-sm">
                      <div className="text-base font-semibold">news.acme.com</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        84K recipients ready
                      </div>
                    </div>
                  </div>
                )}

                {index === 3 && (
                  <div className="w-full max-w-sm rounded-xl border border-border bg-background p-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-muted-foreground">
                          Campaign health
                        </div>
                        <div className="mt-1 text-xl font-semibold">41.8%</div>
                      </div>
                      <div className="rounded-md bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        Live
                      </div>
                    </div>
                    <div className="mt-4 flex h-20 items-end gap-2">
                      {[48, 72, 58, 86, 64, 94, 78].map((height, barIndex) => (
                        <div
                          key={barIndex}
                          className="flex-1 rounded-t-md bg-primary/70"
                          style={{ height: `${height}%` }}
                        />
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {["Opens", "Clicks", "Cost"].map((metric) => (
                        <div
                          key={metric}
                          className="rounded-lg border border-border bg-muted/30 p-2"
                        >
                          <div className="text-xs text-muted-foreground">
                            {metric}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-5">
                <h3 className="text-lg font-semibold leading-snug tracking-normal md:text-xl">
                  {feature.title}
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground md:text-base md:leading-7">
                  {feature.description}
                </p>
                <div className="mt-4">
                  <Button variant="outline" asChild>
                    <Link href="/features">Learn more</Link>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="about">
        <SectionHeading
          label="About"
          heading="We build tools that marketers actually love."
          subheading="Learn more about what we do and why we do it."
          align="left"
        />

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-10">
          <DivHeading
            heading="Built for speed"
            description="Every feature is optimized for performance so your team can move fast without waiting."
            align="left"
          />
          <DivHeading
            heading="Privacy first"
            description="Your data stays yours. We never sell or share your information with third parties."
            align="left"
          />
        </div>
      </Section>

      <Section id="contact" theme="neutral">
        <SectionHeading
          label="Contact"
          heading="Get in touch with us."
          subheading="We'd love to hear from you. Reach out anytime."
        />
      </Section>

      <Section id="pricing" className="border-b-0">
        <SectionHeading
          label="Pricing"
          heading="Simple, transparent pricing."
          subheading="Choose the plan that's right for you. All plans come with a 14-day free trial."
          align="right"
        />
      </Section>
      <Section id="mail-handoff" className="[&>div>div:last-child]:py-0">
        <div className="relative -mx-6 h-[260px] overflow-hidden bg-background sm:-mx-8 sm:h-[340px] md:-mx-16 md:h-[400px] lg:h-[500px]">
          <Image
            src="/visual-left-hand.png"
            alt=""
            width={686}
            height={388}
            className="pointer-events-none absolute left-[-34%] top-[47%] w-[74%] max-w-none -translate-y-1/2 select-none object-contain invert sm:left-[-28%] sm:w-[68%] md:left-[-18%] md:w-[58%] lg:left-[-6%] lg:w-[46%]"
          />
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1/5 bg-gradient-to-r from-background to-transparent" />
          <Image
            src="/visual-envelope.png"
            alt="Purple envelope"
            width={1536}
            height={1024}
            className="absolute left-1/2 top-[49%] z-10 w-24 max-w-[24%] -translate-x-1/2 -translate-y-1/2 rotate-[-7deg] select-none object-contain drop-shadow-2xl sm:w-32 md:w-44 lg:w-56"
          />
          <Image
            src="/visual-right-hand.png"
            alt=""
            width={704}
            height={376}
            className="pointer-events-none absolute right-[-34%] top-[47%] w-[74%] max-w-none -translate-y-1/2 select-none object-contain invert sm:right-[-28%] sm:w-[68%] md:right-[-18%] md:w-[58%] lg:right-[-6%] lg:w-[46%]"
          />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/5 bg-gradient-to-l from-background to-transparent" />
        </div>
      </Section>
    </div>
  );
}

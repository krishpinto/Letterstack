import Link from "next/link";

import { Section } from "@/components/section";
import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";

const contactOptions = [
  {
    title: "Talk through sending setup",
    body: "Map your domain, DNS, and campaign volume before the first production send.",
  },
  {
    title: "Move templates into LetterStack",
    body: "Bring existing newsletter layouts into a reusable visual editing workflow.",
  },
  {
    title: "Plan a launch campaign",
    body: "Use the editor, suppression list, and tracking dashboard for a clean send day.",
  },
] as const;

export default function ContactPage() {
  return (
    <>
      <Section theme="neutral">
        <SectionHeading
          label="Contact"
          heading="Tell us what you want to send."
          subheading="Whether you are testing your first campaign or moving from a legacy email platform, LetterStack is built to keep the path clear."
        />

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {contactOptions.map((option) => (
            <article
              key={option.title}
              className="rounded-lg border border-border bg-background p-5 shadow-sm"
            >
              <h2 className="text-lg font-semibold tracking-normal">
                {option.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {option.body}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button size="lg" asChild>
            <a href="mailto:hello@letterstack.app">Email LetterStack</a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/dashboard">Open dashboard</Link>
          </Button>
        </div>
      </Section>
    </>
  );
}

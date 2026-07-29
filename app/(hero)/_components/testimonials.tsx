"use client";

import { cn } from "@/lib/utils";
import { Marquee } from "@/components/ui/marquee";
import { SectionHeading } from "./section-heading";

const REVIEWS = [
  {
    name: "Lucia Garza",
    username: "Growth lead",
    body: "The editor finally lets us build campaign emails as HTML instead of shipping one giant blurry image.",
    img: "https://avatar.vercel.sh/lucia-garza",
    metric: "Template setup",
  },
  {
    name: "Judah Montes",
    username: "Founder",
    body: "We can write the message, preview it, and prepare the send from one place without rebuilding the same layout again.",
    img: "https://avatar.vercel.sh/judah-montes",
    metric: "Faster sends",
  },
  {
    name: "Roselyn McCoy",
    username: "Marketing ops",
    body: "Custom sender domains and bounce states make the whole campaign process feel much more controlled.",
    img: "https://avatar.vercel.sh/roselyn-mccoy",
    metric: "Own domain",
  },
  {
    name: "Jett Higgins",
    username: "Agency partner",
    body: "The template workflow is the part that clicked for us. We can reuse good layouts without locking clients into a bloated suite.",
    img: "https://avatar.vercel.sh/jett-higgins",
    metric: "Reusable layouts",
  },
  {
    name: "Leighton Castillo",
    username: "Newsletter operator",
    body: "The website signup flow feeding straight into contact lists is exactly what a newsletter system should have built in.",
    img: "https://avatar.vercel.sh/leighton-castillo",
    metric: "Subscriber capture",
  },
  {
    name: "Kai Villanueva",
    username: "Product marketer",
    body: "Scheduling, analytics, and delivery status together make LetterStack feel focused on real campaign work.",
    img: "https://avatar.vercel.sh/kai-villanueva",
    metric: "Send visibility",
  },
];

const firstRow = REVIEWS.slice(0, REVIEWS.length / 2);
const secondRow = REVIEWS.slice(REVIEWS.length / 2);

function ReviewCard({
  img,
  name,
  username,
  body,
}: {
  img: string;
  name: string;
  username: string;
  body: string;
}) {
  return (
    <figure
      className={cn(
        "relative flex h-full w-[20rem] cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-white p-4 transition-colors duration-200",
        "hover:border-[#6D5BD0]/50 hover:bg-[#F7F5FF]"
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-[#6D5BD0] opacity-80" />

      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-row items-center gap-3">
          <img
            className="size-9 shrink-0 rounded-full border border-border bg-muted"
            width="36"
            height="36"
            alt={name}
            src={img}
          />
          <div className="flex min-w-0 flex-col">
            <figcaption className="truncate text-sm font-semibold leading-none text-[#0A0A0A]">
              {name}
            </figcaption>
            <p className="mt-1 truncate text-xs font-medium leading-none text-[#717171]">
              {username}
            </p>
          </div>
        </div>
      </div>

      <blockquote className="mt-4 text-sm leading-relaxed text-[#3F3F46]">
        &quot;{body}&quot;
      </blockquote>

      <div className="mt-4 flex items-center gap-1.5 border-t border-border pt-3.5 text-[11px] font-mono uppercase tracking-normal text-[#6D5BD0]">
        <span className="size-1.5 rounded-full bg-[#6D5BD0]" />
        LetterStack sender
      </div>
    </figure>
  );
}

export function Testimonials() {
  return (
    <section id="testimonials" className="scroll-mt-24 overflow-hidden bg-white py-24 sm:py-28">
      <div className="mx-auto max-w-screen-xl px-6 lg:px-10">
        <SectionHeading
          className="mb-14"
          description="Campaign teams use LetterStack to move from design to audience to delivery without turning every email into a manual production job."
        >
          Built for people who send real campaigns.
        </SectionHeading>

        <div className="relative flex w-full flex-col items-center justify-center overflow-hidden py-3">
          <Marquee pauseOnHover className="[--duration:28s] [--gap:0.75rem]">
            {firstRow.map((review) => (
              <ReviewCard key={review.name} {...review} />
            ))}
          </Marquee>

          <Marquee reverse pauseOnHover className="mt-2 [--duration:28s] [--gap:0.75rem]">
            {secondRow.map((review) => (
              <ReviewCard key={review.name} {...review} />
            ))}
          </Marquee>

          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-1/4 bg-gradient-to-r from-white via-white/85 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-1/4 bg-gradient-to-l from-white via-white/85 to-transparent" />
        </div>
      </div>
    </section>
  );
}
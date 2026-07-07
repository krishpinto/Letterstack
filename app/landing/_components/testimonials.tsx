"use client";

import { cn } from "@/lib/utils";
import { Marquee } from "@/components/ui/marquee";
import { SectionHeading } from "./section-heading";

const REVIEWS = [
  {
    name: "Jack",
    username: "@jack",
    body: "I've never seen anything like this before. It's amazing. I love it.",
    img: "https://avatar.vercel.sh/jack",
  },
  {
    name: "Jill",
    username: "@jill",
    body: "I don't know what to say. I'm speechless. This is amazing.",
    img: "https://avatar.vercel.sh/jill",
  },
  {
    name: "John",
    username: "@john",
    body: "I'm at a loss for words. This is amazing. I love it.",
    img: "https://avatar.vercel.sh/john",
  },
  {
    name: "Jane",
    username: "@jane",
    body: "I'm at a loss for words. This is amazing. I love it.",
    img: "https://avatar.vercel.sh/jane",
  },
  {
    name: "Jenny",
    username: "@jenny",
    body: "I'm at a loss for words. This is amazing. I love it.",
    img: "https://avatar.vercel.sh/jenny",
  },
  {
    name: "James",
    username: "@james",
    body: "I'm at a loss for words. This is amazing. I love it.",
    img: "https://avatar.vercel.sh/james",
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
        "relative w-72 cursor-pointer overflow-hidden rounded-2xl border border-border/40 p-5 transition-colors duration-200",
        "bg-muted/40 hover:bg-muted/60"
      )}
    >
      <div className="flex flex-row items-center gap-3">
        <img className="rounded-full bg-muted shrink-0" width="36" height="36" alt={name} src={img} />
        <div className="flex flex-col min-w-0">
          <figcaption className="text-sm font-bold text-[#0A0A0A] leading-none">
            {name}
          </figcaption>
          <p className="text-xs text-[#717171] mt-1 leading-none">{username}</p>
        </div>
      </div>
      <blockquote className="mt-3 text-sm leading-relaxed text-[#4B5563]">{body}</blockquote>
    </figure>
  );
}

export function Testimonials() {
  return (
    <section className="py-24 sm:py-28 bg-white overflow-hidden">
      <div className="mx-auto max-w-screen-xl px-6 lg:px-10">
        
        {/* Title */}
        <SectionHeading 
          className="mb-16"
          description="Loved by developers, growth marketers, and engineering leaders worldwide."
        >
          What senders are saying.
        </SectionHeading>

        {/* Marquee Wrapper with side fade shadows (transparent background, no borders) */}
        <div className="relative flex w-full flex-col items-center justify-center overflow-hidden py-4">
          
          <Marquee pauseOnHover className="[--duration:25s]">
            {firstRow.map((review) => (
              <ReviewCard key={review.username} {...review} />
            ))}
          </Marquee>
          
          <Marquee reverse pauseOnHover className="[--duration:25s] mt-2">
            {secondRow.map((review) => (
              <ReviewCard key={review.username} {...review} />
            ))}
          </Marquee>

          {/* Left/Right side gradient overlay masks fading to white */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-white via-white/80 to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-white via-white/80 to-transparent z-10" />
        </div>

      </div>
    </section>
  );
}

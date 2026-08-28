"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const TESTIMONIALS = [
  {
    quote: "We built Letterstack to give developers a single, robust API that handles email delivery, authentication, and inbox placement automatically.",
    name: "Ethan Rodrigues",
    role: "Co-Founder & CTO, Letterstack",
    initials: "ER",
    gradient: "from-[#6366F1] to-[#D946EF]"
  },
  {
    quote: "Instead of hacking together template engines, bounce monitors, and routing services, Letterstack manages your entire email delivery pipeline in one fast tool.",
    name: "Krish Pinto",
    role: "Co-Founder & CEO, Letterstack",
    initials: "KP",
    gradient: "from-[#3B82F6] to-[#10B981]"
  }
];

export function FounderTestimonials() {
  const [activeIndex, setActiveIndex] = useState(0);

  // Auto-next every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev === TESTIMONIALS.length - 1 ? 0 : prev + 1));
    }, 10000);

    return () => clearInterval(timer);
  }, [activeIndex]);

  return (
    // id + scroll-mt-24 to match the other landing sections: the navbar has
    // linked to /#testimonials all along, but nothing on the page carried
    // the anchor, so the link did nothing.
    <section
      id="testimonials"
      className="scroll-mt-24 py-12 sm:py-16 bg-white overflow-hidden"
    >
      <div className="mx-auto max-w-screen-lg px-6">
        
        {/* Testimonial slider outer container */}
        <div className="relative flex flex-col items-center text-center">
          
          {/* Muted wrapper card containing background texture, titles, and slides */}
          <div className="relative w-full rounded-2xl border border-border/40 bg-muted/50 p-6 sm:p-8 md:p-10 overflow-hidden flex flex-col items-center">
            {/* Low opacity background image covering full card edges (inset-0) */}
            <div 
              className="absolute inset-0 rounded-2xl bg-no-repeat bg-bottom opacity-[0.25] pointer-events-none overflow-hidden"
              // style={{ 
              //   backgroundImage: "url('/herobg.png')",
              //   backgroundSize: "100% auto"
              // }} 
            >
              {/* Fade overlay at the bottom of the background image */}
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-neutral-100/90 via-neutral-100/40 to-transparent" />
            </div>

            {/* Eyebrow Label Box (Huberman Lab style border-box) - Moved INSIDE */}
            <div className="mb-6 inline-block border-2 border-[#5D5FEF] px-4 py-1 text-xs font-black uppercase tracking-[0.2em] text-[#5D5FEF] select-none z-10">
              Letterstack Founders
            </div>

            {/* Testimonial Slides Container (elevated z-index) */}
            <div className="relative z-10 w-full mb-6">
              {TESTIMONIALS.map((t, index) => (
                <div
                  key={index}
                  className={cn(
                    "transition-all duration-500 transform flex flex-col items-center",
                    activeIndex === index
                      ? "relative opacity-100 scale-100 pointer-events-auto flex flex-col items-center"
                      : "absolute inset-x-0 top-0 opacity-0 scale-95 pointer-events-none flex flex-col items-center"
                  )}
                >
                  {/* Quote */}
                  <blockquote className="mb-6">
                    <p 
                      className="text-lg sm:text-2xl lg:text-3xl font-medium leading-relaxed sm:leading-relaxed text-[#0A0A0A] max-w-3xl mx-auto px-4"
                      style={{ fontFamily: "var(--font-bricolage, var(--font-inter))" }}
                    >
                      “{t.quote}”
                    </p>
                  </blockquote>
                  
                  {/* Abstract avatar monogram */}
                  <div className={cn(
                    "size-12 rounded-full bg-gradient-to-tr shadow-sm flex items-center justify-center text-white text-xs font-black font-sans tracking-wider mb-2.5 select-none",
                    t.gradient
                  )}>
                    {t.initials}
                  </div>
                  
                  {/* Author Info */}
                  <cite className="not-italic">
                    <p className="text-sm font-bold text-[#0A0A0A]">{t.name}</p>
                    <p className="text-[11px] text-[#717170] mt-0.5">{t.role}</p>
                  </cite>
                </div>
              ))}
            </div>

            {/* Pagination dots (capsule indicators) - Moved INSIDE with high contrast */}
            <div className="flex gap-2 relative z-20">
              {TESTIMONIALS.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveIndex(index)}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
                    activeIndex === index ? "w-5 bg-[#0A0A0A]" : "w-1.5 bg-[#0A0A0A]/20"
                  )}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}

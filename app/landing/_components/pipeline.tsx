"use client";

import { Mail, Check, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const RECIPIENTS = [
  { name: "Lucia Garza", initials: "LG", status: "Opened", statusColor: "text-emerald-600", checkColor: "text-emerald-600" },
  { name: "Judah Montes", initials: "JM", status: "Delivered", statusColor: "text-muted-foreground", checkColor: "text-muted-foreground" },
  { name: "Roselyn McCoy", initials: "RM", status: "Clicked", statusColor: "text-emerald-600", checkColor: "text-emerald-600" },
  { name: "Jett Higgins", initials: "JH", status: "Delivered", statusColor: "text-muted-foreground", checkColor: "text-muted-foreground" },
  { name: "Leighton Castillo", initials: "LC", status: "Opened", statusColor: "text-emerald-600", checkColor: "text-emerald-600" },
  { name: "Kai Villanueva", initials: "KV", status: "Delivered", statusColor: "text-muted-foreground", checkColor: "text-muted-foreground" }
];

export function PipelineSection() {
  return (
    <section className="py-20 sm:py-24 bg-[#FAFAFC] border-b border-[#E4E4E7] overflow-hidden">
      <div className="mx-auto max-w-screen-xl px-6 lg:px-10">
        
        {/* ── Title block ─────────────────────────────────────────────────── */}
        <div className="text-center max-w-2xl mx-auto mb-14 sm:mb-16">
          <h2 
            className="text-3xl font-bold leading-[1.08] tracking-tight text-[#0A0A0A] sm:text-4xl"
            style={{ fontFamily: "var(--font-bricolage, var(--font-inter))" }}
          >
            Simple two-step delivery
          </h2>
          <p className="mt-3 text-base text-[#717171] leading-relaxed">
            Draft your layout templates, assign your subscriber lists, and dispatch campaigns to millions of inboxes instantly.
          </p>
        </div>

        {/* ── Two-Step Container ───────────────────────────────────────────── */}
        <div className="grid gap-12 lg:grid-cols-12 lg:items-stretch relative">
          
          {/* ── Step 1: State of the art email editor (5 cols) ───────────────── */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* <div>
              <Badge variant="secondary" className="uppercase font-semibold tracking-wider text-[10px] px-2 py-0.5 rounded-full select-none">
                Step 1
              </Badge>
              <h3 
                className="text-lg font-bold text-[#0A0A0A] mt-2"
                style={{ fontFamily: "var(--font-bricolage, var(--font-inter))" }}
              >
                State of the Art Editor
              </h3>
              <p className="text-xs text-[#717171] mt-1">Compose personalized campaigns with dynamic variable tokens.</p>
            </div> */}

            {/* Email Composer Card */}
            <div 
              className="rounded-2xl border border-[#E4E4E7] bg-white p-5 shadow-sm flex flex-col gap-4 font-sans text-xs text-[#0A0A0A]"
              style={{
                maskImage: "linear-gradient(to bottom, black 65%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, black 65%, transparent 100%)"
              }}
            >
              {/* To field with tokenized chips */}
              <div className="flex flex-wrap items-center gap-1.5 border-b border-[#F4F4F5] pb-3">
                <span className="w-8 text-[#717170] shrink-0">To:</span>
                <span className="rounded bg-[#F4F4F5] border border-[#E4E4E7] px-2 py-0.5 font-medium flex items-center gap-1">
                  Lucia Garza
                </span>
                <span className="rounded bg-[#F4F4F5] border border-[#E4E4E7] px-2 py-0.5 font-medium flex items-center gap-1">
                  Judah Montes
                </span>
                <span className="rounded bg-[#F4F4F5] border border-[#E4E4E7] px-2 py-0.5 font-medium flex items-center gap-1">
                  Roselyn McCoy
                </span>
                <Badge variant="secondary" className="text-[10px] font-bold py-0.5 px-2 rounded-full">
                  +3 more
                </Badge>
              </div>
              
              <div className="flex items-center gap-2 border-b border-[#F4F4F5] pb-2">
                <span className="w-8 text-[#717170] shrink-0">Cc:</span>
                <span className="text-[#A1A1AA]">Optional carbon copy list</span>
              </div>

              <div className="flex items-center gap-2 border-b border-[#F4F4F5] pb-2">
                <span className="w-8 text-[#717170] shrink-0">Subj:</span>
                <span className="font-semibold text-[#0A0A0A]">Welcome to Letterstack</span>
              </div>

              <div className="flex items-center gap-2 border-b border-[#F4F4F5] pb-2">
                <span className="w-8 text-[#717170] shrink-0">From:</span>
                <span className="font-medium text-[#717170]">setup@letterstack.io</span>
              </div>

              {/* Template Body area */}
              <div className="pt-2 text-[#4B5563] space-y-3 leading-relaxed bg-[#FAFBFB] rounded-lg p-3 border border-[#F4F4F5]">
                <p className="font-medium text-[#0A0A0A]">Hi {"{first_name}"},</p>
                <p>
                  We are building state-of-the-art web applications with{" "}
                  <span className="text-primary font-semibold">React and TypeScript</span> using industry best practices.
                </p>
                <div className="h-6 w-20 rounded bg-primary flex items-center justify-center text-[9px] text-primary-foreground font-bold select-none">
                  Get Started
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Arrow Connector (1 col) */}
          <div className="hidden lg:flex lg:col-span-1 items-center justify-center">
            <div className="size-10 rounded-full border border-[#E4E4E7] bg-white flex items-center justify-center shadow-sm select-none">
              <ArrowRight className="size-5 text-[#717171]" />
            </div>
          </div>

          {/* ── Step 2: Send Mass & Connections (6 cols) ────────────────────── */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            {/* <div>
              <Badge variant="secondary" className="uppercase font-semibold tracking-wider text-[10px] px-2 py-0.5 rounded-full select-none">
                Step 2
              </Badge>
              <h3 
                className="text-lg font-bold text-[#0A0A0A] mt-2"
                style={{ fontFamily: "var(--font-bricolage, var(--font-inter))" }}
              >
                Send Mass Campaign
              </h3>
              <p className="text-xs text-[#717171] mt-1">Distribute template renders to lists of users instantly.</p>
            </div> */}

            {/* Mass Delivery visualizer container */}
            <div className="flex-1 rounded-2xl p-5 flex items-center justify-between gap-6 relative min-h-[300px] lg:min-h-0">
              
              {/* Left Side: Centralized Letterstack Sender Hub */}
              <div className="flex flex-col items-center gap-2 z-10">
                <div className="size-16 rounded-2xl border border-[#E4E4E7] bg-[#FAFAFA] shadow-md flex items-center justify-center transform -rotate-6">
                  {/* Letter / Mail Illustration logo */}
                  <div className="size-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
                    <Mail className="size-6" />
                  </div>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#A1A1AA]">Sender Hub</span>
              </div>

              {/* Center: Dynamic SVG connecting branches (desktop only) */}
              <div className="hidden sm:block absolute left-24 right-44 top-6 bottom-6 pointer-events-none">
                <svg className="size-full" viewBox="0 0 100 200" fill="none" preserveAspectRatio="none">
                  {/* Dotted bezier lines drawing from left point to right stack points */}
                  <path d="M 0 100 C 50 100, 50 15, 100 15" stroke="#E4E4E7" strokeWidth="1.5" strokeDasharray="3 3" />
                  <path d="M 0 100 C 50 100, 50 50, 100 50" stroke="#E4E4E7" strokeWidth="1.5" strokeDasharray="3 3" />
                  <path d="M 0 100 C 50 100, 50 82, 100 82" stroke="#E4E4E7" strokeWidth="1.5" strokeDasharray="3 3" />
                  <path d="M 0 100 C 50 100, 50 118, 100 118" stroke="#E4E4E7" strokeWidth="1.5" strokeDasharray="3 3" />
                  <path d="M 0 100 C 50 100, 50 150, 100 150" stroke="#E4E4E7" strokeWidth="1.5" strokeDasharray="3 3" />
                  <path d="M 0 100 C 50 100, 50 185, 100 185" stroke="#E4E4E7" strokeWidth="1.5" strokeDasharray="3 3" />
                </svg>
              </div>

              {/* Right Side: Stack of 6 recipient cards */}
              <div className="flex-1 flex flex-col gap-2 max-w-[190px] z-10 ml-auto">
                {RECIPIENTS.map((rec, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between border border-[#F4F4F5] bg-[#FAFBFB] rounded-lg p-2 text-[10.5px] shadow-sm hover:translate-x-0.5 transition-transform duration-200"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Solid circular initials avatar */}
                      <div className="size-5 rounded-full bg-primary/10 text-primary text-[8px] font-bold flex items-center justify-center shrink-0">
                        {rec.initials}
                      </div>
                      <span className="font-semibold text-[#0A0A0A] truncate leading-none">
                        {rec.name}
                      </span>
                    </div>

                    {/* Check icon + status */}
                    <div className="flex items-center gap-1 shrink-0 ml-1.5">
                      <span className={cn("text-[9px] font-semibold leading-none", rec.statusColor)}>
                        {rec.status}
                      </span>
                      <Check className={cn("size-3 shrink-0", rec.checkColor)} />
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>

        </div>

      </div>
    </section>
  );
}

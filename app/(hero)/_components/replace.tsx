"use client";

import {
  BarChart3Icon,
  LayoutTemplateIcon,
  MailPlusIcon,
  SendIcon,
  ShieldCheckIcon,
  UsersIcon,
  WorkflowIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

// ─── Floating job cards ──────────────────────────────────────────────────────

// The jobs LetterStack does, drawn as the cards floating around the heading.
// These used to be other companies' logos (including Amazon SES, which
// LetterStack sends through rather than replaces), which read as a claim of
// replacing transactional email APIs that the product does not offer.
const JOBS = [
  { icon: LayoutTemplateIcon, label: "Block editor", color: "text-[#5D5FEF]" },
  { icon: UsersIcon, label: "Contacts", color: "text-[#0284C7]" },
  { icon: MailPlusIcon, label: "Signup forms", color: "text-[#D97706]" },
  { icon: SendIcon, label: "Sending", color: "text-[#059669]" },
  { icon: ShieldCheckIcon, label: "Bounce handling", color: "text-[#DC2626]" },
  { icon: BarChart3Icon, label: "Analytics", color: "text-[#7C3AED]" },
  { icon: WorkflowIcon, label: "Automations", color: "text-[#0A0A0A]" },
] as const;

function JobIcon({ index }: { index: number }) {
  const job = JOBS[index];
  const Icon = job.icon;
  return (
    <>
      <Icon className={cn("size-8", job.color)} aria-hidden />
      <span className="sr-only">{job.label}</span>
    </>
  );
}

interface FloatingCardProps {
  children: React.ReactNode;
  className: string;
  delayClass: string;
}

function FloatingCard({ children, className, delayClass }: FloatingCardProps) {
  return (
    <div
      className={cn(
        "absolute rounded-2xl bg-white border border-[#E4E4E7] shadow-md p-3 flex items-center justify-center transition-transform duration-300 hover:scale-110 hover:shadow-lg select-none z-10",
        className,
        delayClass
      )}
      style={{
        animation: "float 6s ease-in-out infinite",
      }}
    >
      {children}
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function ReplaceSection() {
  return (
    <section className="relative py-28 lg:py-40 bg-white border-t border-[#E4E4E7] overflow-hidden">
      
      {/* ── Background decoration / grids ─────────────────────────────────── */}
      <div className="absolute inset-0 bg-[#FAFAFA] opacity-60 pointer-events-none" />
      
      {/* ── Scattered Mail Service Icons (Desktop/Tablet) ────────────────── */}
      <div className="hidden md:block absolute inset-0 max-w-screen-xl mx-auto pointer-events-none">
        {/* SendGrid (Top Left) */}
        <FloatingCard className="left-[6%] top-[15%]" delayClass="[animation-delay:0s]">
          <JobIcon index={0} />
        </FloatingCard>
        
        {/* Mailchimp (Mid Left) */}
        <FloatingCard className="left-[12%] top-[45%]" delayClass="[animation-delay:1.5s]">
          <JobIcon index={1} />
        </FloatingCard>

        {/* Amazon SES (Bottom Left) */}
        <FloatingCard className="left-[8%] top-[70%]" delayClass="[animation-delay:3s]">
          <JobIcon index={2} />
        </FloatingCard>

        {/* Postmark (Top Right) */}
        <FloatingCard className="right-[8%] top-[12%]" delayClass="[animation-delay:0.75s]">
          <JobIcon index={3} />
        </FloatingCard>

        {/* Resend (Mid Right) */}
        <FloatingCard className="right-[14%] top-[40%]" delayClass="[animation-delay:2.2s]">
          <JobIcon index={4} />
        </FloatingCard>

        {/* Mailgun (Bottom Right) */}
        <FloatingCard className="right-[9%] top-[68%]" delayClass="[animation-delay:3.8s]">
          <JobIcon index={5} />
        </FloatingCard>

        {/* SparkPost (Far Right Side) */}
        <FloatingCard className="right-[4%] top-[30%]" delayClass="[animation-delay:1s]">
          <JobIcon index={6} />
        </FloatingCard>
      </div>

      <div className="relative mx-auto max-w-screen-xl px-6 lg:px-10 z-10 text-center">
        
        {/* ── 3D Stacked Icon Card (Center) ────────────────────────────────── */}
        <div className="relative size-28 mx-auto mb-10 flex items-center justify-center">
          {/* Back Card (deepest) */}
          <div className="absolute size-20 rounded-2xl bg-neutral-200/60 border border-neutral-300 transform -translate-y-4 scale-90 opacity-40 shadow-sm" />
          {/* Middle Card */}
          <div className="absolute size-24 rounded-2xl bg-neutral-100/90 border border-neutral-200 transform -translate-y-2 scale-95 opacity-80 shadow-md" />
          {/* Front Card (Active Logo) */}
          <div className="absolute size-28 rounded-3xl bg-white border border-neutral-200/80 shadow-2xl flex items-center justify-center transform hover:rotate-3 transition-transform duration-300">
            {/* 12-Spoke Letterstack Logo */}
            <svg className="size-16 text-[#5D5FEF]" viewBox="0 0 100 100" fill="none">
              <g stroke="currentColor" strokeWidth="8" strokeLinecap="round">
                {Array.from({ length: 12 }).map((_, i) => {
                  const angle = (i * 30 * Math.PI) / 180;
                  const x1 = 50 + Math.cos(angle) * 16;
                  const y1 = 50 + Math.sin(angle) * 16;
                  const x2 = 50 + Math.cos(angle) * 38;
                  const y2 = 50 + Math.sin(angle) * 38;
                  return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
                })}
              </g>
            </svg>
          </div>
        </div>

        {/* ── Central Typography ───────────────────────────────────────────── */}
        <h2 
          className="max-w-3xl mx-auto text-4xl font-bold leading-[1.08] tracking-tight text-[#0A0A0A] sm:text-5xl lg:text-6xl mb-6"
          style={{ fontFamily: "var(--font-bricolage, var(--font-inter))" }}
        >
          One tool for the newsletter you send every month.
        </h2>
        
        <p className="max-w-xl mx-auto text-lg leading-relaxed text-[#717171]">
          Design, contacts, signup forms, sending and bounce handling in one place, with delivery through Amazon SES from your own domain.
        </p>

        {/* ── Mobile-Only Icon Grid (So they don't get lost on smaller screens) ── */}
        <div className="md:hidden mt-12 flex flex-wrap justify-center gap-4">
          <div className="rounded-xl bg-[#F4F4F5] border border-[#E4E4E7] p-2"><JobIcon index={0} /></div>
          <div className="rounded-xl bg-[#F4F4F5] border border-[#E4E4E7] p-2"><JobIcon index={1} /></div>
          <div className="rounded-xl bg-[#F4F4F5] border border-[#E4E4E7] p-2"><JobIcon index={2} /></div>
          <div className="rounded-xl bg-[#F4F4F5] border border-[#E4E4E7] p-2"><JobIcon index={3} /></div>
          <div className="rounded-xl bg-[#F4F4F5] border border-[#E4E4E7] p-2"><JobIcon index={4} /></div>
          <div className="rounded-xl bg-[#F4F4F5] border border-[#E4E4E7] p-2"><JobIcon index={5} /></div>
        </div>

      </div>

      {/* Global CSS float animation injected locally */}
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-12px);
          }
        }
      `}</style>
    </section>
  );
}

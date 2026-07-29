"use client";

import { cn } from "@/lib/utils";

// ─── High Fidelity SVG Logos for Email Services ────────────────────────────────

function SendGridLogo() {
  return (
    <svg className="size-8 text-[#009BDE]" viewBox="0 0 24 24" fill="currentColor">
      {/* SendGrid grid block logo representation */}
      <rect x="2" y="2" width="8" height="8" rx="1.5" />
      <rect x="14" y="2" width="8" height="8" rx="1.5" />
      <rect x="2" y="14" width="8" height="8" rx="1.5" />
      <rect x="14" y="14" width="8" height="8" rx="1.5" />
      <circle cx="12" cy="12" r="3.5" className="fill-white stroke-[#009BDE] stroke-2" />
    </svg>
  );
}

function PostmarkLogo() {
  return (
    <svg className="size-8 text-[#F7A823]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Postmark stamp/envelope logo representation */}
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 6l9 6 9-6" />
      <circle cx="18" cy="14" r="3" strokeWidth="1.5" className="fill-[#F7A823]/10" />
      <line x1="16.5" y1="12.5" x2="19.5" y2="15.5" />
    </svg>
  );
}

function MailchimpLogo() {
  return (
    <svg className="size-8 text-[#FFE01B]" viewBox="0 0 24 24" fill="currentColor">
      {/* Mailchimp yellow stamp with monkey outline */}
      <circle cx="12" cy="12" r="10" className="text-[#FFE01B]" />
      <path d="M12 6a4 4 0 00-4 4c0 1.5.8 2.5 1.5 3a2.5 2.5 0 01-1.5 2.5v.5h8v-.5a2.5 2.5 0 01-1.5-2.5c.7-.5 1.5-1.5 1.5-3a4 4 0 00-4-4zm0 6a2 2 0 110-4 2 2 0 010 4z" className="text-black" />
    </svg>
  );
}

function AmazonSESLogo() {
  return (
    <svg className="size-8 text-[#FF9900]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {/* AWS Database/Queue logo representation */}
      <rect x="3" y="3" width="18" height="6" rx="1" />
      <rect x="3" y="11" width="18" height="6" rx="1" />
      <path d="M7 6h10M7 14h10" />
      <circle cx="12" cy="20" r="1.5" fill="currentColor" />
    </svg>
  );
}

function ResendLogo() {
  return (
    <div className="size-8 bg-black rounded flex items-center justify-center text-white font-bold font-sans text-base select-none">
      R
    </div>
  );
}

function MailgunLogo() {
  return (
    <svg className="size-8 text-[#E11D48]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      {/* Target/Shield Mailgun logo representation */}
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  );
}

function SparkPostLogo() {
  return (
    <svg className="size-8 text-[#FF5A5F]" viewBox="0 0 24 24" fill="currentColor">
      {/* SparkPost Flame/Spark representation */}
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 10.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7z" />
    </svg>
  );
}

// ─── Floating Card component with local animation delay ──────────────────────

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
          <SendGridLogo />
        </FloatingCard>
        
        {/* Mailchimp (Mid Left) */}
        <FloatingCard className="left-[12%] top-[45%]" delayClass="[animation-delay:1.5s]">
          <MailchimpLogo />
        </FloatingCard>

        {/* Amazon SES (Bottom Left) */}
        <FloatingCard className="left-[8%] top-[70%]" delayClass="[animation-delay:3s]">
          <AmazonSESLogo />
        </FloatingCard>

        {/* Postmark (Top Right) */}
        <FloatingCard className="right-[8%] top-[12%]" delayClass="[animation-delay:0.75s]">
          <PostmarkLogo />
        </FloatingCard>

        {/* Resend (Mid Right) */}
        <FloatingCard className="right-[14%] top-[40%]" delayClass="[animation-delay:2.2s]">
          <ResendLogo />
        </FloatingCard>

        {/* Mailgun (Bottom Right) */}
        <FloatingCard className="right-[9%] top-[68%]" delayClass="[animation-delay:3.8s]">
          <MailgunLogo />
        </FloatingCard>

        {/* SparkPost (Far Right Side) */}
        <FloatingCard className="right-[4%] top-[30%]" delayClass="[animation-delay:1s]">
          <SparkPostLogo />
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
          Letterstack replaces your entire email delivery stack.
        </h2>
        
        <p className="max-w-xl mx-auto text-lg leading-relaxed text-[#717171]">
          Stop wiring together different services for marketing campaigns, transactional logs, bounce protection, and template designers. Letterstack does all of it, built on a single robust platform.
        </p>

        {/* ── Mobile-Only Icon Grid (So they don't get lost on smaller screens) ── */}
        <div className="md:hidden mt-12 flex flex-wrap justify-center gap-4">
          <div className="rounded-xl bg-[#F4F4F5] border border-[#E4E4E7] p-2"><SendGridLogo /></div>
          <div className="rounded-xl bg-[#F4F4F5] border border-[#E4E4E7] p-2"><MailchimpLogo /></div>
          <div className="rounded-xl bg-[#F4F4F5] border border-[#E4E4E7] p-2"><AmazonSESLogo /></div>
          <div className="rounded-xl bg-[#F4F4F5] border border-[#E4E4E7] p-2"><PostmarkLogo /></div>
          <div className="rounded-xl bg-[#F4F4F5] border border-[#E4E4E7] p-2"><ResendLogo /></div>
          <div className="rounded-xl bg-[#F4F4F5] border border-[#E4E4E7] p-2"><MailgunLogo /></div>
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

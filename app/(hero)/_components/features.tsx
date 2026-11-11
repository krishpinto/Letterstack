"use client";

import { useCallback, useState, useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Code,
  FolderIcon,
  GitBranch,
  Mail,
  Play,
  Send,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Product mockups, one per slide ──────────────────────────────────────────
//
// Each mockup shows something the product does today. Numbers are example
// values for the illustration, not claims about real customers. Before
// adding a slide, check the feature exists: these were once a React-email
// code editor, IP pools, a deliverability score, Node/Python SDKs and
// outbound webhooks, none of which LetterStack has.

const PANEL =
  "grid h-full grid-cols-1 divide-y divide-[#E4E4E7] border border-[#E4E4E7] rounded-xl bg-white shadow-sm md:grid-cols-12 md:divide-x md:divide-y-0";
const LEFT =
  "flex flex-col bg-[#FAFBFB] rounded-t-xl md:rounded-tr-none md:rounded-l-xl p-5";
const RIGHT =
  "flex flex-col bg-white rounded-b-xl md:rounded-bl-none md:rounded-r-xl p-5";
const LABEL = "text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA]";

function CreateMockup() {
  const blocks = ["Logo", "Heading", "Paragraph", "Image", "Button", "Columns", "Social", "Footer"];
  return (
    <div className={PANEL}>
      <div className={cn(LEFT, "md:col-span-5")}>
        <span className={cn(LABEL, "mb-4")}>Blocks</span>
        <div className="grid grid-cols-2 gap-2">
          {blocks.map((block) => (
            <div
              key={block}
              className="rounded-lg border border-[#E4E4E7] bg-white px-3 py-2 text-[11px] font-medium text-[#0A0A0A] shadow-sm"
            >
              {block}
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-[#71717A]">
          Drag a block onto the canvas. Undo, redo and autosave included.
        </p>
      </div>

      <div className={cn(RIGHT, "md:col-span-7 text-[12px]")}>
        <div className="mb-3 flex items-center justify-between">
          <span className={LABEL}>Preview</span>
          <span className="rounded bg-[#E0F2FE] px-1.5 py-0.5 text-[10px] font-medium text-[#0369A1]">
            Desktop · Mobile
          </span>
        </div>
        <div className="flex flex-1 flex-col justify-center">
          <div className="space-y-3 rounded-lg border border-[#E4E4E7] bg-[#FCFCFD] p-4 shadow-sm">
            <div className="h-4 w-20 rounded bg-[#5D5FEF]/15" />
            <p className="text-base font-semibold text-[#0A0A0A]">The March update</p>
            <div className="h-16 w-full rounded bg-[#F4F4F5]" />
            <p className="leading-relaxed text-[#71717A]">
              Three new features, one fixed bug, and the date for our next meetup.
            </p>
            <div className="w-28 rounded-lg bg-[#0A0A0A] py-2 text-center text-[11px] font-semibold text-white">
              Read more
            </div>
            <p className="border-t border-[#F4F4F5] pt-2 text-[10px] text-[#A1A1AA]">Unsubscribe</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeliveryMockup() {
  const logs = [
    { time: "09:00:01", event: "Campaign compiled to email-safe HTML", status: "success" },
    { time: "09:00:01", event: "1,240 recipients queued in batches of 50", status: "success" },
    { time: "09:00:02", event: "Batch 1 of 25 sent through Amazon SES", status: "success" },
    { time: "09:00:09", event: "Batch 25 of 25 sent", status: "success" },
    { time: "09:00:14", event: "Delivery events arriving from SES", status: "info" },
  ];
  const steps = [
    { n: 1, color: "bg-blue-500", title: "Your campaign", sub: "Frozen as an HTML snapshot" },
    { n: 2, color: "bg-emerald-500", title: "Queue", sub: "Batches, retry-safe" },
    { n: 3, color: "bg-indigo-500", title: "Amazon SES", sub: "From your verified domain" },
  ];

  return (
    <div className={PANEL}>
      <div className={cn(LEFT, "md:col-span-5")}>
        <span className={cn(LABEL, "mb-4")}>How a send runs</span>
        <div className="relative flex flex-1 flex-col justify-around pl-3">
          <div className="absolute bottom-[24px] left-[20px] top-[24px] w-0.5 bg-gradient-to-b from-blue-400 via-emerald-400 to-indigo-400" />
          {steps.map((step) => (
            <div key={step.n} className="z-10 flex items-center gap-3.5">
              <div
                className={cn(
                  "flex size-[18px] items-center justify-center rounded-full border-2 border-white text-[8px] text-white shadow-sm",
                  step.color,
                )}
              >
                {step.n}
              </div>
              <div>
                <p className="text-[11px] font-bold text-[#0A0A0A]">{step.title}</p>
                <p className="text-[10px] text-[#71717A]">{step.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col overflow-hidden rounded-b-xl bg-white font-mono text-[11px] md:col-span-7 md:rounded-bl-none md:rounded-r-xl">
        <div className="flex items-center gap-1.5 border-b border-[#F0F0F0] bg-[#FAFBFB] px-4 py-2.5 font-sans font-medium text-[#71717A]">
          <Send className="size-3.5" />
          Send progress
        </div>
        <div className="max-h-[170px] select-none space-y-2 overflow-y-auto p-4 leading-relaxed md:max-h-none">
          {logs.map((log, index) => (
            <div key={index} className="flex items-start gap-2.5">
              <span className="tracking-tight text-[#A1A1AA]">{log.time}</span>
              <span className={cn("font-bold", log.status === "success" ? "text-emerald-600" : "text-indigo-600")}>
                {log.status === "success" ? "✓" : "i"}
              </span>
              <span className="leading-tight text-[#0A0A0A]">{log.event}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProtectMockup() {
  const rows = [
    { label: "DKIM", value: "Verified for yourdomain.com", ok: true },
    { label: "Custom MAIL FROM", value: "Verified, aligned for DMARC", ok: true },
    { label: "jane@old-company.com", value: "Hard bounce, suppressed", ok: false },
    { label: "sam@example.org", value: "Marked as spam, suppressed", ok: false },
  ];
  return (
    <div className={PANEL}>
      <div className={cn(LEFT, "justify-center md:col-span-5")}>
        <span className={cn(LABEL, "mb-3")}>Suppression list</span>
        <p className="text-[12px] leading-relaxed text-[#3F3F46]">
          A hard bounce or a spam complaint adds the address to your suppression
          list. Every later campaign skips it, so one bad address does not keep
          hurting your sending reputation.
        </p>
      </div>
      <div className={cn(RIGHT, "md:col-span-7")}>
        <span className={cn(LABEL, "mb-4")}>Domain and list health</span>
        <div className="flex flex-1 flex-col justify-center gap-3">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center gap-3 border-b border-[#F4F4F5] pb-2 text-[12px] last:border-b-0 last:pb-0"
            >
              <ShieldCheck className={cn("size-4 shrink-0", row.ok ? "text-emerald-500" : "text-amber-500")} />
              <div className="min-w-0 flex-1">
                <p className="mb-0.5 truncate font-semibold leading-none text-[#0A0A0A]">{row.label}</p>
                <p className="text-[11px] leading-none text-[#71717A]">{row.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ContactsMockup() {
  const folders = [
    { name: "Monthly newsletter", count: "1,240" },
    { name: "Event attendees", count: "312" },
    { name: "Volunteers", count: "86" },
  ];
  const mapping = [
    { from: "E-mail Address", to: "email" },
    { from: "Full Name", to: "name" },
  ];
  return (
    <div className={PANEL}>
      <div className={cn(LEFT, "md:col-span-6")}>
        <div className="mb-4 flex items-center gap-2">
          <Upload className="size-4 text-[#A1A1AA]" />
          <span className={LABEL}>Import members.xlsx</span>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-2.5">
          {mapping.map((m) => (
            <div
              key={m.from}
              className="flex items-center justify-between rounded-lg border border-[#E4E4E7] bg-white p-3 text-[11.5px]"
            >
              <span className="text-[#71717A]">{m.from}</span>
              <span className="font-semibold text-[#0A0A0A]">→ {m.to}</span>
            </div>
          ))}
          <p className="text-[11px] text-[#71717A]">
            512 rows · 4 duplicates merged · 2 invalid addresses skipped
          </p>
        </div>
      </div>

      <div className={cn(RIGHT, "md:col-span-6")}>
        <span className={cn(LABEL, "mb-4")}>Folders</span>
        <div className="flex flex-1 flex-col justify-center gap-2.5">
          {folders.map((folder) => (
            <div
              key={folder.name}
              className="flex items-center justify-between border-b border-[#F4F4F5] pb-2 text-[11.5px] last:border-b-0 last:pb-0"
            >
              <span className="flex items-center gap-2 font-semibold text-[#0A0A0A]">
                <FolderIcon className="size-3.5 text-[#A1A1AA]" />
                {folder.name}
              </span>
              <span className="tabular-nums text-[#71717A]">{folder.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AnalyzeMockup() {
  const stats = [
    { label: "Delivered", value: "1,236" },
    { label: "Opened", value: "48%" },
    { label: "Clicked", value: "9%" },
    { label: "Bounced", value: "4" },
  ];
  return (
    <div className={PANEL}>
      <div className={cn(LEFT, "md:col-span-6")}>
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="size-4 text-[#A1A1AA]" />
          <span className={LABEL}>Opens per day</span>
        </div>
        <div className="mb-2 flex h-[100px] flex-1 items-end gap-2 border-b border-l border-[#E4E4E7] px-2 pt-2">
          {[90, 62, 35, 22, 15, 10, 8].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm bg-gradient-to-t from-blue-500 to-indigo-500"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between px-1 font-mono text-[9px] text-[#A1A1AA]">
          <span>Day 1</span>
          <span>Day 7</span>
        </div>
      </div>

      <div className={cn(RIGHT, "md:col-span-6")}>
        <span className={cn(LABEL, "mb-4")}>Campaign results</span>
        <div className="grid flex-1 grid-cols-2 content-center gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-[#E4E4E7] bg-[#FAFBFB] p-3">
              <p className="text-[10px] text-[#71717A]">{stat.label}</p>
              <p className="mt-0.5 text-lg font-bold text-[#0A0A0A]">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function IntegrateMockup() {
  return (
    <div className={PANEL}>
      <div className="flex flex-col overflow-hidden rounded-t-xl bg-[#F9F9FB] font-mono text-[11px] md:col-span-7 md:rounded-l-xl md:rounded-tr-none">
        <div className="flex items-center gap-1.5 border-b border-[#E4E4E7] bg-[#F4F4F5] px-4 py-2.5 font-sans font-medium text-[#71717A]">
          <Code className="size-3.5" />
          Add a contact
        </div>
        <div className="select-none space-y-1.5 overflow-x-auto whitespace-nowrap p-4 leading-relaxed">
          <div>
            <span className="text-[#3B82F6]">curl</span> -X POST https://letterstack.site/api/v1/contacts \
          </div>
          <div className="pl-4">
            -H <span className="text-[#10B981]">&quot;Authorization: Bearer ls_live_…&quot;</span> \
          </div>
          <div className="pl-4">
            -H <span className="text-[#10B981]">&quot;Content-Type: application/json&quot;</span> \
          </div>
          <div className="pl-4">
            -d <span className="text-[#10B981]">&apos;{"{"}&quot;email&quot;: &quot;maria@example.com&quot;{"}"}&apos;</span>
          </div>
        </div>
      </div>

      <div className={cn(RIGHT, "justify-center md:col-span-5")}>
        <span className={cn(LABEL, "mb-3")}>API keys</span>
        <div className="space-y-2 rounded-lg border border-[#E4E4E7] bg-[#FAFBFB] p-3 text-[11.5px]">
          <div className="truncate rounded border border-[#E4E4E7] bg-white px-2 py-1 font-mono text-[10px] text-[#71717A]">
            ls_live_…a1b2
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[10px] text-[#047857]">
            {["contacts:read", "contacts:write", "campaigns:read"].map((scope) => (
              <div key={scope} className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-[#10B981]" /> {scope}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AutomateMockup() {
  const steps = [
    { icon: <Play className="size-3 fill-white" />, tone: "bg-black text-white", label: "Trigger:", text: "Contact added" },
    { icon: "1d", tone: "bg-[#E0F2FE] text-[10px] font-bold text-[#0369A1]", label: "Delay:", text: "Wait 1 day" },
    { icon: <Mail className="size-3 text-[#14532D]" />, tone: "bg-[#DCFCE7]", label: "Send:", text: "Welcome email" },
    { icon: <FolderIcon className="size-3 text-[#7C2D12]" />, tone: "bg-[#FFEDD5]", label: "Then:", text: "Add to “Members”" },
  ];
  return (
    <div className={PANEL}>
      <div className={cn(LEFT, "md:col-span-7")}>
        <div className="mb-4 flex items-center gap-2">
          <GitBranch className="size-4 text-[#A1A1AA]" />
          <span className={LABEL}>Welcome flow</span>
        </div>
        <div className="relative flex flex-1 select-none flex-col justify-around pl-3">
          <div className="absolute bottom-[14px] left-[15px] top-[14px] border-l border-dashed border-neutral-300" />
          {steps.map((step) => (
            <div key={step.text} className="z-10 flex items-center gap-3.5">
              <div className={cn("flex size-[20px] items-center justify-center rounded", step.tone)}>{step.icon}</div>
              <div className="rounded-lg border border-[#E4E4E7] bg-white px-3 py-1.5 text-[11px] shadow-sm">
                <span className="font-bold text-[#0A0A0A]">{step.label}</span> {step.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={cn(RIGHT, "justify-center md:col-span-5")}>
        <span className={cn(LABEL, "mb-3")}>Building blocks</span>
        <ul className="space-y-2 text-[11.5px] text-[#3F3F46]">
          <li>Triggers: contact added, contact unsubscribed</li>
          <li>Steps: send email, delay, condition</li>
          <li>Contact actions: add to folder, update, delete</li>
        </ul>
      </div>
    </div>
  );
}

// ─── Section Configuration ───────────────────────────────────────────────────

const FEATURES = [
  {
    id: "create",
    tag: "1.0 Create",
    heading: "Design on a block canvas, not in code.",
    description:
      "Build the email from blocks: headings, images, buttons, columns and more. It compiles to table-based HTML that holds up in Outlook and stays under Gmail's clipping limit.",
    mockup: <CreateMockup />,
  },
  {
    id: "deliver",
    tag: "2.0 Deliver",
    heading: "Batched sending through Amazon SES.",
    description:
      "Each campaign is frozen as an HTML snapshot, queued in batches and sent through Amazon SES from your verified domain. A retried batch never mails anyone twice.",
    mockup: <DeliveryMockup />,
  },
  {
    id: "protect",
    tag: "3.0 Protect",
    heading: "Bounces and complaints suppress themselves.",
    description:
      "Connect your domain with DKIM and a custom MAIL FROM. Hard bounces and spam complaints go straight onto your suppression list, so later sends skip them.",
    mockup: <ProtectMockup />,
  },
  {
    id: "organise",
    tag: "4.0 Organise",
    heading: "Import a list, sort it into folders.",
    description:
      "Upload CSV or Excel. Columns are matched for you, duplicates are merged and invalid addresses are flagged. Send a campaign to one folder or several.",
    mockup: <ContactsMockup />,
  },
  {
    id: "analyze",
    tag: "5.0 Analyze",
    heading: "See what happened to every email.",
    description:
      "Delivered, opened, clicked, bounced and complained, per campaign and across the workspace, from Amazon SES delivery events.",
    mockup: <AnalyzeMockup />,
  },
  {
    id: "integrate",
    tag: "6.0 Integrate",
    heading: "A REST API for contacts and campaigns.",
    description:
      "Create scoped API keys in Settings, then add contacts or read campaign results from your own systems with a plain HTTP request.",
    mockup: <IntegrateMockup />,
  },
  {
    id: "automate",
    tag: "7.0 Automate",
    heading: "Welcome sequences on a flow canvas.",
    description:
      "Start a flow when a contact is added, wait, branch on a condition and send. A new subscriber from a signup form gets the welcome email on their own schedule.",
    mockup: <AutomateMockup />,
  },
];

export function Features() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const activeFeature = FEATURES[activeIndex];

  const handlePrev = useCallback(() => {
    setActiveIndex((prev) => (prev === 0 ? FEATURES.length - 1 : prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    setActiveIndex((prev) => (prev === FEATURES.length - 1 ? 0 : prev + 1));
  }, []);

  // Increment progress from 0 to 100 over 10 seconds
  useEffect(() => {
    setProgress(0);
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        return prev + 1; // 1% every 100ms = 10s total
      });
    }, 100);

    return () => clearInterval(timer);
  }, [activeIndex]);

  // Advance to the next slide once progress reaches 100%
  useEffect(() => {
    if (progress >= 100) {
      handleNext();
    }
  }, [progress, handleNext]);


  return (
    <section id="features" className="scroll-mt-24 py-24 sm:py-28 lg:py-32">
      <div className="mx-auto max-w-screen-xl px-6 lg:px-10">
        
        {/* ── Heading Row (updates with index) ── */}
        <div className="grid gap-8 lg:grid-cols-12 items-end mb-8">
          {/* Left Column: Heading */}
          <div className="lg:col-span-7">
            <h2 
              className="text-4xl font-bold leading-[1.08] tracking-tight text-[#0A0A0A] sm:text-5xl lg:text-6xl min-h-[120px] lg:min-h-[190px] flex items-end font-sans"
              style={{ fontFamily: "var(--font-bricolage, var(--font-inter))" }}
            >
              {activeFeature.heading}
            </h2>
          </div>
          
          {/* Right Column: Description + Controls */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <p className="text-base sm:text-lg leading-relaxed text-[#717171] min-h-[72px]">
              {activeFeature.description}
            </p>
            
            <div className="flex justify-end mt-2">
              {/* Navigation Buttons (Left/Right thin arrow circles) */}
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={handlePrev}
                  className="flex size-9 items-center justify-center rounded-full border border-[#E4E4E7] bg-white text-[#0A0A0A] transition-all hover:bg-[#F4F4F5] active:scale-95 cursor-pointer"
                  aria-label="Previous slide"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <button
                  onClick={handleNext}
                  className="flex size-9 items-center justify-center rounded-full border border-[#E4E4E7] bg-white text-[#0A0A0A] transition-all hover:bg-[#F4F4F5] active:scale-95 cursor-pointer"
                  aria-label="Next slide"
                >
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Full Width Tab Indicators Row ── */}
        <div className="relative border-b border-[#E4E4E7] pb-2 mb-8">
          {/* Left/Right Fade Masks for mobile scrolling */}
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-white via-white/80 to-transparent md:hidden" />
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-white via-white/80 to-transparent md:hidden" />

          {/* Indicators list (horizontal scrollable on mobile, flat on desktop) */}
          <div className="flex gap-6 overflow-x-auto no-scrollbar scroll-smooth pr-16 md:pr-0 pb-1">
            {FEATURES.map((feat, index) => (
              <button
                key={feat.id}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "text-xs font-semibold uppercase tracking-wider transition-colors py-1 relative cursor-pointer shrink-0 pb-2.5",
                  activeIndex === index ? "text-[#0A0A0A]" : "text-[#717171] hover:text-[#0A0A0A]"
                )}
              >
                {feat.tag}
                {/* Underline progress track */}
                <span className={cn(
                  "absolute bottom-0 left-0 right-0 h-0.5 rounded-full overflow-hidden transition-colors",
                  activeIndex === index ? "bg-neutral-200" : "bg-transparent"
                )}>
                  {activeIndex === index && (
                    <span 
                      className="absolute inset-y-0 left-0 bg-[#0A0A0A] transition-all duration-100 ease-linear"
                      style={{ width: `${progress}%` }}
                    />
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Mockup card with muted padding and faded bottom ── */}
        <div className="relative mt-8">
          <div className="rounded-2xl border border-[#E4E4E7] bg-[#F8F8F8] p-4 sm:p-6 lg:p-8 overflow-hidden h-[360px] sm:h-[420px] lg:h-[480px]">
            {/* Inner Wrapper with smooth fade transition */}
            <div className="relative h-full transition-opacity duration-300">
              {FEATURES.map((feat, index) => (
                <div
                  key={feat.id}
                  className={cn(
                    "absolute inset-0 transition-all duration-300 transform",
                    activeIndex === index
                      ? "opacity-100 translate-y-0 pointer-events-auto"
                      : "opacity-0 translate-y-4 pointer-events-none"
                  )}
                >
                  {feat.mockup}
                </div>
              ))}
            </div>
          </div>
          
          {/* Faded overlay at the bottom covering the bottom card outline edge */}
          <div className="absolute inset-x-0 bottom-[-1px] h-32 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none z-10" />
        </div>

        {/* Global style block to hide scrollbars */}
        <style>{`
          .no-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>
      </div>
    </section>
  );
}

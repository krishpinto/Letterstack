"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, ShieldCheck, Send, Terminal, Users, BarChart3, Code, GitBranch, Play, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── High Fidelity HTML Mockups for each slide ────────────────────────────────

function TemplateMockup() {
  return (
    <div className="grid h-full grid-cols-1 divide-y divide-[#E4E4E7] border border-[#E4E4E7] rounded-xl bg-white shadow-sm md:grid-cols-12 md:divide-x md:divide-y-0">
      {/* Code Editor Pane (7 cols) */}
      <div className="md:col-span-7 flex flex-col bg-[#F9F9FB] rounded-t-xl md:rounded-tr-none md:rounded-l-xl overflow-hidden font-mono text-[11px] text-[#3F3F46]">
        {/* Editor Title Bar */}
        <div className="flex items-center justify-between border-b border-[#E4E4E7] px-4 py-2.5 bg-[#F4F4F5]">
          <div className="flex items-center gap-1.5 font-sans font-medium text-[#71717A]">
            <Terminal className="size-3.5" />
            welcome-email.tsx
          </div>
          <span className="text-[10px] text-[#A1A1AA]">TypeScript</span>
        </div>
        
        {/* Code Content */}
        <div className="p-4 space-y-1.5 overflow-x-auto leading-relaxed select-none">
          <div><span className="text-[#3B82F6]">import</span> {"{"} Html, Button, Text {"}"} <span className="text-[#3B82F6]">from</span> <span className="text-[#10B981]">"@react-email"</span>;</div>
          <div className="text-[#A1A1AA]">// Generate personalized client invoice</div>
          <div><span className="text-[#3B82F6]">export default function</span> <span className="text-[#D97706]">InvoiceEmail</span>({"{"} name, amount {"}"}) {"{"}</div>
          <div className="pl-4"><span className="text-[#3B82F6]">return</span> (</div>
          <div className="pl-8 text-[#A1A1AA]">&lt;<span className="text-[#3B82F6]">Html</span>&gt;</div>
          <div className="pl-12 text-[#A1A1AA]">&lt;<span className="text-[#3B82F6]">Text</span>&gt;</div>
          <div className="pl-16 font-semibold text-[#0A0A0A]">Hi {"{"}name{"}"}, your invoice for {"{"}amount{"}"} is ready.</div>
          <div className="pl-12 text-[#A1A1AA]">&lt;/<span className="text-[#3B82F6]">Text</span>&gt;</div>
          <div className="pl-12 text-[#A1A1AA]">&lt;<span className="text-[#3B82F6]">Button</span> <span className="text-[#D97706]">href</span>=<span className="text-[#10B981]">{"{`/invoice/${id}`}"}</span>&gt;</div>
          <div className="pl-16 text-[#0A0A0A]">View Invoice</div>
          <div className="pl-12 text-[#A1A1AA]">&lt;/<span className="text-[#3B82F6]">Button</span>&gt;</div>
          <div className="pl-8 text-[#A1A1AA]">&lt;/<span className="text-[#3B82F6]">Html</span>&gt;</div>
          <div className="pl-4">);</div>
          <div>{"}"}</div>
        </div>
      </div>

      {/* Render Preview Pane (5 cols) */}
      <div className="md:col-span-5 flex flex-col bg-white rounded-b-xl md:rounded-bl-none md:rounded-r-xl overflow-hidden text-[12px]">
        {/* Preview Title Bar */}
        <div className="flex items-center justify-between border-b border-[#F0F0F0] px-4 py-2.5 bg-[#FAFBFB]">
          <span className="font-semibold text-[#0A0A0A] font-sans">Live Render Preview</span>
          <span className="rounded bg-[#E0F2FE] px-1.5 py-0.5 text-[10px] font-medium text-[#0369A1]">Dynamic</span>
        </div>
        
        {/* Email Content wrapper */}
        <div className="p-5 flex-1 flex flex-col justify-center">
          <div className="border border-[#E4E4E7] rounded-lg p-4 space-y-3.5 shadow-sm bg-[#FCFCFD]">
            <div className="flex items-center gap-2 border-b border-[#F4F4F5] pb-2 text-[11px] text-[#71717A]">
              <span className="font-semibold text-[#0A0A0A]">To:</span> Aryan Kapoor
            </div>
            <div className="space-y-2">
              <p className="font-medium text-[#0A0A0A]">Hi Aryan,</p>
              <p className="text-[#71717A] leading-relaxed">
                Your monthly subscription invoice for <span className="font-semibold text-[#0A0A0A]">$29.00</span> is now ready. 
                Click below to view details.
              </p>
            </div>
            <button className="w-full rounded-lg bg-[#0A0A0A] py-2 text-[11.5px] font-semibold text-white transition-all hover:bg-[#141414]">
              View Invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeliveryMockup() {
  const logs = [
    { time: "12:04:01", event: "Request received from API", status: "success" },
    { time: "12:04:02", event: "Personalization compiler completed", status: "success" },
    { time: "12:04:02", event: "DKIM & SPF signature verified", status: "success" },
    { time: "12:04:03", event: "IP Pool assigned: transactional-us-east", status: "success" },
    { time: "12:04:04", event: "Delivered SMTP response (250 OK)", status: "success" },
    { time: "12:04:12", event: "Delivered to target mailbox inbox", status: "success" },
    { time: "12:04:28", event: "Webhook payload sent to client", status: "info" }
  ];

  return (
    <div className="grid h-full grid-cols-1 divide-y divide-[#E4E4E7] border border-[#E4E4E7] rounded-xl bg-white shadow-sm md:grid-cols-12 md:divide-x md:divide-y-0">
      {/* Route visualization map (5 cols) */}
      <div className="md:col-span-5 flex flex-col bg-[#FAFBFB] rounded-t-xl md:rounded-tr-none md:rounded-l-xl p-5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA] mb-4">Route Blueprint</span>
        <div className="flex-1 flex flex-col justify-around relative pl-3">
          {/* vertical connection line */}
          <div className="absolute left-[20px] top-[24px] bottom-[24px] w-0.5 bg-gradient-to-b from-blue-400 via-emerald-400 to-indigo-400" />
          
          <div className="flex items-center gap-3.5 z-10">
            <div className="size-[18px] rounded-full border-2 border-white bg-blue-500 shadow-sm flex items-center justify-center text-[8px] text-white">1</div>
            <div>
              <p className="text-[11px] font-bold text-[#0A0A0A]">Your Application</p>
              <p className="text-[10px] text-[#71717A]">API Payload</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3.5 z-10">
            <div className="size-[18px] rounded-full border-2 border-white bg-emerald-500 shadow-sm flex items-center justify-center text-[8px] text-white">2</div>
            <div>
              <p className="text-[11px] font-bold text-[#0A0A0A]">Letterstack SMTP Pool</p>
              <p className="text-[10px] text-[#71717A]">US-East routed IP</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 z-10">
            <div className="size-[18px] rounded-full border-2 border-white bg-indigo-500 shadow-sm flex items-center justify-center text-[8px] text-white">3</div>
            <div>
              <p className="text-[11px] font-bold text-[#0A0A0A]">Recipient Mailbox</p>
              <p className="text-[10px] text-[#71717A]">Inbox placement</p>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Logs Console (7 cols) */}
      <div className="md:col-span-7 flex flex-col bg-white rounded-b-xl md:rounded-bl-none md:rounded-r-xl overflow-hidden font-mono text-[11px]">
        {/* Title bar */}
        <div className="flex items-center justify-between border-b border-[#F0F0F0] px-4 py-2.5 bg-[#FAFBFB]">
          <div className="flex items-center gap-1.5 font-sans font-medium text-[#71717A]">
            <Send className="size-3.5" />
            Live Delivery Logs
          </div>
          <span className="rounded bg-[#DCFCE7] px-1.5 py-0.5 text-[10px] font-medium text-[#16A34A] flex items-center gap-1 font-sans">
            <span className="size-1 rounded-full bg-[#16A34A] animate-pulse" />
            Active
          </span>
        </div>
        
        {/* Terminal Logs list */}
        <div className="p-4 space-y-2 overflow-y-auto leading-relaxed select-none max-h-[170px] md:max-h-none">
          {logs.map((log, index) => (
            <div key={index} className="flex gap-2.5 items-start">
              <span className="text-[#A1A1AA] tracking-tight">{log.time}</span>
              <span className={cn(
                "font-bold",
                log.status === "success" ? "text-emerald-600" : "text-indigo-600"
              )}>
                {log.status === "success" ? "✓" : "i"}
              </span>
              <span className="text-[#0A0A0A] leading-tight break-all">{log.event}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReputationMockup() {
  const metrics = [
    { label: "IP Address Health", value: "Clean (0 Blocklists)", status: "safe" },
    { label: "SPF & DKIM Keys", value: "Verified & Locked", status: "safe" },
    { label: "DMARC Configuration", value: "Reject Policy Active", status: "safe" },
    { label: "Spam Report Rate", value: "0.01% (Limit: 0.10%)", status: "safe" },
  ];

  return (
    <div className="grid h-full grid-cols-1 divide-y divide-[#E4E4E7] border border-[#E4E4E7] rounded-xl bg-white shadow-sm md:grid-cols-12 md:divide-x md:divide-y-0">
      {/* Gauge and rating (5 cols) */}
      <div className="md:col-span-5 flex flex-col bg-[#FAFBFB] rounded-t-xl md:rounded-tr-none md:rounded-l-xl p-5 items-center justify-center">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA] mb-4 self-start">Deliverability Score</span>
        <div className="relative size-32 flex items-center justify-center">
          {/* Circle Gauge SVG */}
          <svg className="size-full transform -rotate-90">
            <circle cx="64" cy="64" r="50" fill="transparent" stroke="#E4E4E7" strokeWidth="6" />
            <circle cx="64" cy="64" r="50" fill="transparent" stroke="#10B981" strokeWidth="6" strokeDasharray="314" strokeDashoffset="15" />
          </svg>
          <div className="absolute text-center">
            <p className="text-3xl font-black text-[#0A0A0A]">99.8</p>
            <p className="text-[10px] text-[#A1A1AA] uppercase font-bold tracking-wider">Excellent</p>
          </div>
        </div>
      </div>

      {/* Safety checklist (7 cols) */}
      <div className="md:col-span-7 flex flex-col bg-white rounded-b-xl md:rounded-bl-none md:rounded-r-xl p-5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA] mb-4">Domain Reputation Safeguards</span>
        <div className="flex-1 flex flex-col gap-3 justify-center">
          {metrics.map((m, index) => (
            <div key={index} className="flex items-center gap-3 text-[12px] border-b border-[#F4F4F5] pb-2 last:border-b-0 last:pb-0">
              <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[#0A0A0A] font-semibold truncate leading-none mb-0.5">{m.label}</p>
                <p className="text-[#71717A] text-[11px] leading-none">{m.value}</p>
              </div>
              <span className="rounded bg-[#E6F4EA] px-1.5 py-0.5 text-[10px] font-semibold text-[#137333]">Active</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SegmentMockup() {
  const matchingRecipients = [
    { name: "Aryan Kapoor", email: "aryan@superwall.com", status: "Active" },
    { name: "María González", email: "maria@framer.com", status: "Active" },
    { name: "Tom Chen", email: "tom@plane.so", status: "Engaged" },
    { name: "Sarah Kim", email: "sarah@linear.app", status: "Active" }
  ];

  return (
    <div className="grid h-full grid-cols-1 divide-y divide-[#E4E4E7] border border-[#E4E4E7] rounded-xl bg-white shadow-sm md:grid-cols-12 md:divide-x md:divide-y-0">
      {/* Segment filters layout (6 cols) */}
      <div className="md:col-span-6 flex flex-col bg-[#FAFBFB] rounded-t-xl md:rounded-tr-none md:rounded-l-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="size-4 text-[#A1A1AA]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA]">Segment Conditions</span>
        </div>
        
        <div className="flex-1 flex flex-col gap-2.5 justify-center">
          <div className="rounded-lg border border-[#E4E4E7] bg-white p-3 space-y-2">
            <div className="flex items-center gap-2 text-[11.5px]">
              <span className="rounded bg-[#F4F4F5] px-1.5 py-0.5 font-medium text-[#71717A]">WHEN</span>
              <span className="font-semibold text-[#0A0A0A]">Opened Campaign</span>
            </div>
            <div className="text-[11px] text-[#71717A] pl-14">is welcome-onboarding</div>
          </div>
          
          <div className="flex justify-center">
            <span className="rounded bg-black px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">AND</span>
          </div>

          <div className="rounded-lg border border-[#E4E4E7] bg-white p-3 space-y-2">
            <div className="flex items-center gap-2 text-[11.5px]">
              <span className="rounded bg-[#F4F4F5] px-1.5 py-0.5 font-medium text-[#71717A]">WHEN</span>
              <span className="font-semibold text-[#0A0A0A]">Domain Organization</span>
            </div>
            <div className="text-[11px] text-[#71717A] pl-14">is Y-Combinator company</div>
          </div>
        </div>
      </div>

      {/* Matching list preview (6 cols) */}
      <div className="md:col-span-6 flex flex-col bg-white rounded-b-xl md:rounded-bl-none md:rounded-r-xl p-5">
        <div className="flex justify-between items-center mb-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA]">Matching Users</span>
          <span className="rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-semibold text-[#047857]">4 matched</span>
        </div>
        <div className="flex-1 flex flex-col gap-2.5 justify-center">
          {matchingRecipients.map((rec, index) => (
            <div key={index} className="flex items-center justify-between text-[11.5px] border-b border-[#F4F4F5] pb-2 last:border-b-0 last:pb-0">
              <div>
                <p className="font-semibold text-[#0A0A0A] leading-tight">{rec.name}</p>
                <p className="text-[#71717A] text-[10px]">{rec.email}</p>
              </div>
              <span className="rounded-full border border-[#D1FAE5] bg-[#F0FDF4] px-1.5 py-0.5 text-[10px] text-[#065F46] font-medium">
                {rec.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AnalyzeMockup() {
  const clients = [
    { name: "Gmail app", share: "64.2%", bg: "bg-blue-500", w: "w-[64.2%]" },
    { name: "Apple Mail", share: "22.8%", bg: "bg-[#0A0A0A]", w: "w-[22.8%]" },
    { name: "Outlook Client", share: "9.5%", bg: "bg-indigo-500", w: "w-[9.5%]" },
    { name: "Other Clients", share: "3.5%", bg: "bg-[#71717A]", w: "w-[3.5%]" }
  ];

  return (
    <div className="grid h-full grid-cols-1 divide-y divide-[#E4E4E7] border border-[#E4E4E7] rounded-xl bg-white shadow-sm md:grid-cols-12 md:divide-x md:divide-y-0">
      {/* Click Rate visual graph (6 cols) */}
      <div className="md:col-span-6 flex flex-col bg-[#FAFBFB] rounded-t-xl md:rounded-tr-none md:rounded-l-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="size-4 text-[#A1A1AA]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA]">Hourly Open Performance</span>
        </div>
        
        {/* Simple inline SVG chart */}
        <div className="flex-1 flex items-end h-[100px] gap-2 pt-2 border-b border-l border-[#E4E4E7] px-2 mb-2">
          {[20, 35, 25, 48, 62, 40, 75, 55, 90, 70, 85, 95].map((h, i) => (
            <div
              key={i}
              className="flex-1 bg-gradient-to-t from-blue-500 to-indigo-500 rounded-t-sm"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-[#A1A1AA] font-mono px-1">
          <span>08:00 AM</span>
          <span>12:00 PM</span>
          <span>04:00 PM</span>
        </div>
      </div>

      {/* Client share metrics (6 cols) */}
      <div className="md:col-span-6 flex flex-col bg-white rounded-b-xl md:rounded-bl-none md:rounded-r-xl p-5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA] mb-4">Client Agent Distribution</span>
        <div className="flex-1 flex flex-col gap-3 justify-center">
          {clients.map((c, index) => (
            <div key={index} className="space-y-1">
              <div className="flex justify-between text-[11px] font-medium">
                <span className="text-[#71717A]">{c.name}</span>
                <span className="text-[#0A0A0A] font-bold">{c.share}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#F4F4F5] overflow-hidden">
                <div className={cn("h-full rounded-full", c.bg, c.w)} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function IntegrateMockup() {
  return (
    <div className="grid h-full grid-cols-1 divide-y divide-[#E4E4E7] border border-[#E4E4E7] rounded-xl bg-white shadow-sm md:grid-cols-12 md:divide-x md:divide-y-0">
      {/* Code SDK selection (7 cols) */}
      <div className="md:col-span-7 flex flex-col bg-[#F9F9FB] rounded-t-xl md:rounded-tr-none md:rounded-l-xl overflow-hidden font-mono text-[11px]">
        {/* Tabs Bar */}
        <div className="flex items-center justify-between border-b border-[#E4E4E7] px-4 py-2.5 bg-[#F4F4F5]">
          <div className="flex items-center gap-1.5 font-sans font-medium text-[#71717A]">
            <Code className="size-3.5" />
            Client API Setup
          </div>
          <div className="flex gap-2 font-sans">
            <span className="rounded bg-white px-2 py-0.5 border border-[#E4E4E7] text-[10px] text-[#0A0A0A] font-bold">Node.js</span>
            <span className="text-[10px] text-[#A1A1AA] py-0.5">Python</span>
          </div>
        </div>

        {/* Code Content */}
        <div className="p-4 space-y-1.5 overflow-x-auto leading-relaxed select-none">
          <div><span className="text-[#3B82F6]">const</span> letterstack = <span className="text-[#3B82F6]">require</span>(<span className="text-[#10B981]">"letterstack-node"</span>);</div>
          <div><span className="text-[#3B82F6]">const</span> client = <span className="text-[#3B82F6]">new</span> letterstack.<span className="text-[#D97706]">Client</span>({"{"}</div>
          <div className="pl-4">apiKey: <span className="text-[#10B981]">"ls_live_a1b2c3d4..."</span></div>
          <div>{"}"});</div>
          <div className="pt-2">client.emails.<span className="text-[#D97706]">send</span>({"{"}</div>
          <div className="pl-4">from: <span className="text-[#10B981]">"Aryan &lt;aryan@superwall.com&gt;"</span>,</div>
          <div className="pl-4">to: <span className="text-[#10B981]">"maria@framer.com"</span>,</div>
          <div className="pl-4">subject: <span className="text-[#10B981]">"Welcome to the stack 🚀"</span></div>
          <div>{"}"});</div>
        </div>
      </div>

      {/* Webhook endpoint card (5 cols) */}
      <div className="md:col-span-5 flex flex-col bg-white rounded-b-xl md:rounded-bl-none md:rounded-r-xl p-5 justify-center">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA] mb-3">Live Event Webhooks</span>
        <div className="rounded-lg border border-[#E4E4E7] bg-[#FAFBFB] p-3 space-y-2 text-[11.5px]">
          <div>
            <span className="font-bold text-[#0A0A0A]">Endpoint URL</span>
            <div className="mt-1 font-mono text-[10px] bg-white border border-[#E4E4E7] rounded px-2 py-1 text-[#71717A] truncate">
              https://api.framer.com/webhooks/emails
            </div>
          </div>
          <div className="space-y-1">
            <span className="font-bold text-[#0A0A0A]">Subscribed Events</span>
            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              <div className="flex items-center gap-1.5 text-[#047857]"><span className="size-1.5 rounded-full bg-[#10B981]" /> delivered</div>
              <div className="flex items-center gap-1.5 text-[#047857]"><span className="size-1.5 rounded-full bg-[#10B981]" /> opened</div>
              <div className="flex items-center gap-1.5 text-[#047857]"><span className="size-1.5 rounded-full bg-[#10B981]" /> clicked</div>
              <div className="flex items-center gap-1.5 text-[#A1A1AA]"><span className="size-1.5 rounded-full bg-[#A1A1AA]" /> bounced</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AutomateMockup() {
  return (
    <div className="grid h-full grid-cols-1 divide-y divide-[#E4E4E7] border border-[#E4E4E7] rounded-xl bg-white shadow-sm md:grid-cols-12 md:divide-x md:divide-y-0">
      {/* Workflow Builder Canvas (7 cols) */}
      <div className="md:col-span-7 flex flex-col bg-[#FAFBFB] rounded-t-xl md:rounded-tr-none md:rounded-l-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <GitBranch className="size-4 text-[#A1A1AA]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA]">Onboarding Flow Steps</span>
        </div>
        
        <div className="flex-1 flex flex-col justify-around relative pl-3 select-none">
          {/* Connecting line */}
          <div className="absolute left-[15px] top-[14px] bottom-[14px] w-0.5 bg-dashed border-l border-neutral-300" />

          <div className="flex items-center gap-3.5 z-10">
            <div className="size-[20px] rounded bg-black text-white flex items-center justify-center"><Play className="size-3 fill-white" /></div>
            <div className="bg-white border border-[#E4E4E7] rounded-lg px-3 py-1.5 shadow-sm text-[11px]">
              <span className="font-bold text-[#0A0A0A]">Trigger:</span> Account Signup
            </div>
          </div>

          <div className="flex items-center gap-3.5 z-10">
            <div className="size-[20px] rounded bg-[#E0F2FE] text-[#0369A1] flex items-center justify-center text-[10px] font-bold">1d</div>
            <div className="bg-white border border-[#E4E4E7] rounded-lg px-3 py-1.5 shadow-sm text-[11px]">
              <span className="font-bold text-[#0A0A0A]">Action:</span> Wait 24 Hours
            </div>
          </div>

          <div className="flex items-center gap-3.5 z-10">
            <div className="size-[20px] rounded bg-[#DCFCE7] text-[#14532D] flex items-center justify-center"><Mail className="size-3 text-[#14532D]" /></div>
            <div className="bg-white border border-[#E4E4E7] rounded-lg px-3 py-1.5 shadow-sm text-[11px]">
              <span className="font-bold text-[#0A0A0A]">Action:</span> Send Product Walkthrough
            </div>
          </div>
        </div>
      </div>

      {/* Automated conversions breakdown (5 cols) */}
      <div className="md:col-span-5 flex flex-col bg-white rounded-b-xl md:rounded-bl-none md:rounded-r-xl p-5 justify-center">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA] mb-4">Journey Conversion Rate</span>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-[11px] font-medium mb-1">
              <span className="text-[#71717A]">Step 1 (Welcome Onboarding)</span>
              <span className="text-[#0A0A0A] font-bold">96.8%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#F4F4F5] overflow-hidden">
              <div className="h-full rounded-full bg-[#10B981] w-[96.8%]" />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[11px] font-medium mb-1">
              <span className="text-[#71717A]">Step 2 (Product Walkthrough)</span>
              <span className="text-[#0A0A0A] font-bold">78.4%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#F4F4F5] overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 w-[78.4%]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section Configuration ──────────────────────────────────────────────────

const FEATURES = [
  {
    id: "create",
    tag: "1.0 Create",
    heading: "Design email layouts with total layout control.",
    description:
      "Compose layouts with React or custom raw templates. Inject recipient fields, lists, and loops seamlessly and test live renders immediately.",
    mockup: <TemplateMockup />,
  },
  {
    id: "deliver",
    tag: "2.0 Deliver",
    heading: "Scale transactions with bulletproof routing.",
    description:
      "Our delivery servers route bulk transaction requests with automated DKIM verification, custom queues, and responsive trace logging.",
    mockup: <DeliveryMockup />,
  },
  {
    id: "protect",
    tag: "3.0 Protect",
    heading: "Automate reputation shields to stay in the inbox.",
    description:
      "Automatic domain health scans, real-time spam diagnostics, and blocklist guards shield your deliverability scores without manual config.",
    mockup: <ReputationMockup />,
  },
  {
    id: "segment",
    tag: "4.0 Segment",
    heading: "Filter recipients with granular conditions.",
    description:
      "Filter your list based on opens, clicks, organization domains, and custom fields. Build precise target lists without database queries.",
    mockup: <SegmentMockup />,
  },
  {
    id: "analyze",
    tag: "5.0 Analyze",
    heading: "Deconstruct performance with sub-second analytics.",
    description:
      "Review hourly trends, monitor target recipient client clients, and extract real-time open distributions to optimize your next send.",
    mockup: <AnalyzeMockup />,
  },
  {
    id: "integrate",
    tag: "6.0 Integrate",
    heading: "Deploy API & event webhooks in minutes.",
    description:
      "Set up our lightweight Node, Python, and cURL client endpoints or configure live callback webhooks to trigger event signals instantly.",
    mockup: <IntegrateMockup />,
  },
  {
    id: "automate",
    tag: "7.0 Automate",
    heading: "Orchestrate flows with trigger campaigns.",
    description:
      "Build visual client pathways to trigger follow-up campaigns after signups, clicks, or delays. Measure performance at every automated milestone.",
    mockup: <AutomateMockup />,
  },
];

export function Features() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const activeFeature = FEATURES[activeIndex];

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
  }, [progress]);

  const handlePrev = () => {
    setActiveIndex((prev) => (prev === 0 ? FEATURES.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev === FEATURES.length - 1 ? 0 : prev + 1));
  };

  return (
    <section className="py-24 sm:py-28 lg:py-32">
      <div className="mx-auto max-w-screen-xl px-6 lg:px-10">
        
        {/* ── Heading Row (updates with index) ───────────────────────────────── */}
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

        {/* ── Full Width Tab Indicators Row ─────────────────────────────────── */}
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

        {/* ── Mockup card with muted padding and faded bottom ────────────────── */}
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

"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Check, Globe, Inbox, Send } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  CountUp,
  DemoButton,
  EMERALD,
  StatusPill,
  Tick,
  VIOLET,
  Visual,
  cardSurface,
  chipSurface,
  useEntered,
  useMotion,
  useWidth,
} from "./features-kit";

// ─── Domain ──────────────────────────────────────────────────────────────────
//
// The DNS records a sending domain needs: three DKIM CNAMEs, then an MX and
// an SPF TXT on the MAIL FROM subdomain. Each record is wired to the domain.
// "Check DNS" verifies them one after another, the way the real page fills in
// as SES sees each record: the wire turns green, then the record's tick draws.

const RECORDS = [
  { type: "CNAME", host: "k1._domainkey", purpose: "DKIM" },
  { type: "CNAME", host: "k2._domainkey", purpose: "DKIM" },
  { type: "CNAME", host: "k3._domainkey", purpose: "DKIM" },
  { type: "MX", host: "mail", purpose: "MAIL FROM" },
  { type: "TXT", host: "mail", purpose: "SPF" },
];

// Record rows are 32px tall with 8px between them; the wires are drawn from
// those numbers, so the two must change together.
const ROW = 32;
const PITCH = 40;
const WIRES_HEIGHT = RECORDS.length * PITCH - (PITCH - ROW);

function wire(i: number, width: number) {
  const from = ROW / 2 + i * PITCH;
  const to = WIRES_HEIGHT / 2 + (i - (RECORDS.length - 1) / 2) * 7;
  return `M0 ${from} C${width * 0.55} ${from} ${width * 0.45} ${to} ${width} ${to}`;
}

export function DomainDemo() {
  const { reduce, t } = useMotion();
  const visual = useRef<HTMLDivElement>(null);
  const entered = useEntered(visual);
  const [wires, wiresWidth] = useWidth<HTMLDivElement>();
  // How many records have come back verified. -1 means not checked yet.
  const [verified, setVerified] = useState(-1);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);

  const idle = verified === -1;
  const done = verified === RECORDS.length;
  const checking = !idle && !done;

  const onPress = () => {
    if (checking) return;
    stop();
    if (done) {
      setVerified(-1);
      return;
    }
    if (reduce) {
      setVerified(RECORDS.length);
      return;
    }
    setVerified(0);
    timer.current = setInterval(() => {
      setVerified((count) => {
        if (count + 1 >= RECORDS.length) stop();
        return count + 1;
      });
    }, 320);
  };

  return (
    <Visual ref={visual} backdrop="dots" className="h-[308px]">
      <div className="flex flex-1 items-center">
        <ul className="flex w-[178px] shrink-0 flex-col gap-2 @lg:w-[244px]">
          {RECORDS.map((record, i) => {
            const ok = i < verified;
            const busy = checking && i === verified;
            return (
              <li
                key={record.type + record.host + i}
                className={cn("flex h-8 items-center gap-2 rounded-lg pr-2 pl-1.5", chipSurface)}
              >
                <span className="w-[42px] shrink-0 rounded-[5px] bg-neutral-100 text-center font-mono text-[10px] leading-5 text-neutral-600">
                  {record.type}
                </span>
                <span className="min-w-0 truncate font-mono text-[11.5px] text-neutral-800">
                  {record.host}
                </span>
                <span className="ml-auto hidden shrink-0 text-[11px] text-neutral-500 @lg:block">
                  {record.purpose}
                </span>
                <Tick on={ok} className="ml-auto @lg:ml-0" />
                <span className="sr-only">
                  {record.purpose}: {ok ? "verified" : busy ? "checking" : "pending"}
                </span>
              </li>
            );
          })}
        </ul>

        <div ref={wires} className="relative min-w-6 flex-1" style={{ height: WIRES_HEIGHT }} aria-hidden>
          {wiresWidth > 0 && (
            <svg
              width={wiresWidth}
              height={WIRES_HEIGHT}
              className="absolute inset-0 overflow-visible"
              fill="none"
            >
              {RECORDS.map((_, i) => (
                <motion.path
                  key={`base-${i}`}
                  d={wire(i, wiresWidth)}
                  stroke="#d4d4d4"
                  strokeWidth={1}
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: entered ? 1 : 0 }}
                  transition={t(0.6, i * 0.06)}
                />
              ))}
              {RECORDS.map((_, i) => {
                const lit = i < verified || (checking && i === verified);
                return (
                  <motion.path
                    key={`lit-${i}`}
                    d={wire(i, wiresWidth)}
                    stroke={EMERALD}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    initial={false}
                    animate={{ pathLength: lit ? 1 : 0, opacity: lit ? 1 : 0 }}
                    transition={t(lit ? 0.32 : 0.2)}
                  />
                );
              })}
            </svg>
          )}
        </div>

        <div
          className={cn(
            "flex w-[104px] shrink-0 flex-col items-center rounded-xl px-2 pt-3.5 pb-3 text-center @lg:w-[136px]",
            cardSurface,
          )}
        >
          <span
            className={cn(
              "relative flex size-10 items-center justify-center rounded-[10px] border transition-[background-color,border-color,color] duration-300",
              done
                ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                : "border-neutral-200 bg-neutral-50 text-neutral-600",
            )}
          >
            <Globe className="size-5" strokeWidth={1.5} aria-hidden />
          </span>
          <p className="mt-2.5 text-[12px] leading-[1.3] font-medium text-neutral-900">
            northfieldarts
            <br />
            .example.org
          </p>
          <StatusPill tone={done ? "success" : "neutral"} className="mt-2">
            {done ? "Verified" : "Pending"}
          </StatusPill>
        </div>
      </div>

      <div className="flex min-h-9 items-center gap-3 pb-1">
        <p className="min-w-0 text-xs leading-snug text-pretty text-neutral-500" aria-live="polite">
          {done
            ? "Ready to send as news@northfieldarts.example.org."
            : checking
              ? "Looking up each record…"
              : "Add these five records at your DNS host."}
        </p>
        <DemoButton
          variant={done ? "secondary" : "primary"}
          className="ml-auto"
          aria-disabled={checking}
          onClick={onPress}
        >
          {done ? "Reset" : checking ? "Checking…" : "Check DNS"}
        </DemoButton>
      </div>
    </Visual>
  );
}

// ─── Batches ─────────────────────────────────────────────────────────────────
//
// One batch of 50 that stopped part-way. Resuming it sends only the people
// who were still waiting: each recipient row is claimed before it is mailed,
// so the ones already sent are skipped rather than mailed again. The squares
// are the recipients; the lane carries the waiting ones to the inbox.

const BATCH = 50;
const SENT_BEFORE_STALL = 32;
const WAITING = BATCH - SENT_BEFORE_STALL;
const STAGGER_MS = 40;
// Ten squares by five. They are 13px with 5px between them, and 16px with
// 6px in a cell at least 512px wide (the `@lg` container size below).
const SQUARES = { small: { size: 13, gap: 5 }, large: { size: 16, gap: 6 } };
// The lane arrives at the middle of the inbox tile, which is 48px tall and
// sits at the top of its column.
const LANE_TO = 24;

export function BatchDemo() {
  const { reduce, t } = useMotion();
  const [visual, visualWidth] = useWidth<HTMLDivElement>();
  const entered = useEntered(visual);
  const [lane, laneWidth] = useWidth<HTMLDivElement>();
  const [resumed, setResumed] = useState(false);

  const { size, gap } = visualWidth >= 512 ? SQUARES.large : SQUARES.small;
  const gridHeight = 5 * size + 4 * gap;
  // The lane leaves the grid between its last two rows, where the waiting
  // recipients are.
  const laneFrom = 4 * (size + gap) - gap / 2;
  const laneMiddle = (laneFrom + LANE_TO) / 2;
  const path = `M0 ${laneFrom} C${laneWidth * 0.5} ${laneFrom} ${laneWidth * 0.5} ${LANE_TO} ${laneWidth} ${LANE_TO}`;
  const sendSeconds = (WAITING * STAGGER_MS) / 1000 + 0.2;

  return (
    <Visual ref={visual} backdrop="dots" className="h-[308px]">
      <div className="flex items-center gap-2 text-[13px]">
        <Send className="size-3.5 shrink-0 text-neutral-500" aria-hidden />
        <span className="font-medium text-neutral-900">Batch 3 of 25</span>
        <span className="text-xs text-neutral-500">50 recipients</span>
        <StatusPill tone={resumed ? "success" : "warning"} className="ml-auto">
          {resumed ? "Sent" : "Stalled"}
        </StatusPill>
      </div>

      <div className="flex flex-1 items-center">
        <div
          role="img"
          aria-label={
            resumed
              ? "All 50 recipients in the batch have been sent to."
              : "32 of the 50 recipients in the batch have been sent to. 18 are waiting."
          }
          className="grid w-fit shrink-0 grid-cols-10 gap-[5px] @lg:gap-1.5"
        >
          {Array.from({ length: BATCH }, (_, i) => {
            const late = i >= SENT_BEFORE_STALL;
            return (
              <span
                key={i}
                style={
                  late && resumed
                    ? { transitionDelay: `${(i - SENT_BEFORE_STALL) * STAGGER_MS}ms` }
                    : undefined
                }
                className={cn(
                  "size-[13px] rounded-[4px] border @lg:size-4 @lg:rounded-[5px]",
                  !late && "border-neutral-900 bg-neutral-900",
                  late && "transition-[background-color,border-color] duration-200",
                  late && (resumed ? "border-[#6C5ED1] bg-[#6C5ED1]" : "border-neutral-300 bg-white"),
                )}
              />
            );
          })}
        </div>

        <div ref={lane} className="relative min-w-10 flex-1" style={{ height: gridHeight }} aria-hidden>
          {laneWidth > 0 && (
            <svg
              width={laneWidth}
              height={gridHeight}
              className="absolute inset-0 overflow-visible"
              fill="none"
            >
              {/* Stopped: a dashed lane. Resumed: a solid one. */}
              <motion.path
                d={path}
                stroke="#c4c4c4"
                strokeWidth={1.25}
                strokeDasharray="3 4"
                initial={{ opacity: 0 }}
                animate={{ opacity: entered && !resumed ? 1 : 0 }}
                transition={t(0.4)}
              />
              <motion.path
                d={path}
                stroke={VIOLET}
                strokeOpacity={0.45}
                strokeWidth={1.25}
                initial={false}
                animate={{ pathLength: resumed ? 1 : 0, opacity: resumed ? 1 : 0 }}
                transition={t(resumed ? 0.5 : 0.2)}
              />
              {/* The waiting recipients leaving for the inbox. */}
              {resumed && !reduce && (
                <motion.path
                  d={path}
                  stroke={VIOLET}
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeDasharray="0.1 15"
                  initial={{ strokeDashoffset: 0, opacity: 0 }}
                  animate={{ strokeDashoffset: -15 * WAITING, opacity: [0, 1, 1, 0] }}
                  transition={{
                    duration: sendSeconds + 0.25,
                    ease: "linear",
                    opacity: { duration: sendSeconds + 0.25, times: [0, 0.1, 0.82, 1] },
                  }}
                />
              )}
              {/* Where it stopped. */}
              <motion.g
                initial={false}
                animate={{ scale: resumed ? 0.5 : 1, opacity: resumed ? 0 : 1 }}
                transition={t(0.25)}
              >
                <circle cx={laneWidth / 2} cy={laneMiddle} r="9" fill="#fffbeb" stroke="#fcd34d" />
                <path
                  d={`M${laneWidth / 2 - 2.5} ${laneMiddle - 3.5}v7M${laneWidth / 2 + 2.5} ${laneMiddle - 3.5}v7`}
                  stroke="#d97706"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                />
              </motion.g>
            </svg>
          )}
        </div>

        <div className="flex w-16 shrink-0 flex-col items-center" style={{ height: gridHeight }}>
          <span
            className={cn(
              "relative flex size-12 items-center justify-center rounded-xl text-neutral-700",
              cardSurface,
            )}
          >
            <Inbox className="size-5" strokeWidth={1.5} aria-hidden />
            <Tick bare on={resumed} delay={sendSeconds} className="absolute -top-1.5 -right-1.5" />
          </span>
          <p className="mt-auto text-xs whitespace-nowrap text-neutral-500">
            <CountUp
              value={resumed ? BATCH : SENT_BEFORE_STALL}
              duration={sendSeconds}
              linear
              className="font-medium text-neutral-900"
            />{" "}
            of {BATCH}
          </p>
        </div>
      </div>

      <ul className="flex min-h-10 flex-wrap content-start gap-x-4 gap-y-1 text-xs text-neutral-600">
        <li className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="size-2.5 shrink-0 rounded-[3px] bg-neutral-900" aria-hidden />
          <span>
            <span className="font-medium text-neutral-900 tabular-nums">{SENT_BEFORE_STALL}</span>{" "}
            {resumed ? "already sent, skipped" : "sent before it stopped"}
          </span>
        </li>
        <li className="flex items-center gap-1.5 whitespace-nowrap">
          <span
            aria-hidden
            className={cn(
              "size-2.5 shrink-0 rounded-[3px] border transition-colors duration-200",
              resumed ? "border-[#6C5ED1] bg-[#6C5ED1]" : "border-neutral-300 bg-white",
            )}
          />
          <span>
            <span className="font-medium text-neutral-900 tabular-nums">{WAITING}</span>{" "}
            {resumed ? "sent on resume" : "still waiting"}
          </span>
        </li>
        <li
          className={cn(
            "flex items-center gap-1.5 whitespace-nowrap transition-opacity duration-300",
            resumed ? "opacity-100 delay-700" : "opacity-0",
          )}
          aria-hidden={!resumed}
        >
          <Check className="size-3 shrink-0 text-emerald-600" strokeWidth={3} aria-hidden />
          <span>
            <span className="font-medium text-neutral-900 tabular-nums">0</span> mailed twice
          </span>
        </li>
      </ul>

      <div className="flex min-h-9 items-center gap-3 pt-2 pb-1">
        <p className="min-w-0 text-xs leading-snug text-pretty text-neutral-500" aria-live="polite">
          {resumed ? "Only the 18 who were waiting got it." : "The send stopped part-way."}
        </p>
        <DemoButton
          variant={resumed ? "secondary" : "primary"}
          className="ml-auto"
          onClick={() => setResumed((value) => !value)}
        >
          {resumed ? "Reset" : "Resume send"}
        </DemoButton>
      </div>
    </Visual>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CalendarClock,
  Check,
  Clock,
  GitBranch,
  Lock,
  Mail,
  UserPlus,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { displayFont, focusRing } from "../landing-ui";
import {
  ChoiceGroup,
  DemoButton,
  Panel,
  StatusPill,
  VIOLET,
  Visual,
  cardSurface,
  chips,
  segmented,
  useEntered,
  useMotion,
  useOnScreen,
  useWidth,
} from "./features-kit";

// ─── Analytics ───────────────────────────────────────────────────────────────
//
// The five numbers the product keeps for every send, over twelve weeks.
// Choosing one redraws the line; pointing at the chart, or focusing it and
// pressing the arrow keys, reads out one week. All figures are made up for
// the illustration.

type MetricKey = "delivered" | "opened" | "clicked" | "bounced" | "complained";

const METRICS: {
  key: MetricKey;
  label: string;
  unit: "count" | "rate";
  noun: string;
  weeks: number[];
}[] = [
  {
    key: "delivered",
    label: "Delivered",
    unit: "count",
    noun: "emails delivered",
    weeks: [1012, 1048, 1031, 1096, 1120, 1104, 1175, 1198, 1186, 1240, 1236, 1262],
  },
  {
    key: "opened",
    label: "Opened",
    unit: "rate",
    noun: "of delivered emails opened",
    weeks: [41, 43, 42, 45, 44, 47, 46, 48, 45, 49, 48, 50],
  },
  {
    key: "clicked",
    label: "Clicked",
    unit: "rate",
    noun: "of delivered emails clicked",
    weeks: [6.1, 6.8, 6.4, 7.2, 7, 7.9, 7.5, 8.3, 7.8, 8.6, 9, 8.8],
  },
  {
    key: "bounced",
    label: "Bounced",
    unit: "count",
    noun: "emails bounced",
    weeks: [9, 7, 6, 5, 4, 4, 3, 3, 2, 3, 2, 2],
  },
  {
    key: "complained",
    label: "Complained",
    unit: "count",
    noun: "spam complaints",
    weeks: [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
  },
];

const WEEKS = 12;
const CHART_HEIGHT = 152;
const CHART_TOP = 30;
const CHART_BOTTOM = 6;

function formatMetric(value: number, unit: "count" | "rate") {
  return unit === "rate"
    ? `${value.toLocaleString("en-GB", { maximumFractionDigits: 1 })}%`
    : value.toLocaleString("en-GB");
}

/** Total for counts, average for rates: the figure shown on each tab. */
function summarise(metric: (typeof METRICS)[number]) {
  const total = metric.weeks.reduce((sum, week) => sum + week, 0);
  return metric.unit === "rate" ? Math.round((total / metric.weeks.length) * 10) / 10 : total;
}

const round = (value: number) => Math.round(value * 10) / 10;

/** Where each week sits in a chart `width` pixels wide. */
function plotPoints(weeks: number[], width: number) {
  const max = Math.max(...weeks);
  const min = Math.min(...weeks);
  const span = max - min || 1;
  // The floor sits below the lowest week so the shape of the trend is visible.
  const low = Math.max(0, min - span * 0.6);
  const high = max + span * 0.1;
  const step = width / (weeks.length - 1);
  const usable = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM;
  return weeks.map((value, i) => ({
    x: round(i * step),
    y: round(CHART_TOP + (1 - (value - low) / (high - low)) * usable),
  }));
}

/**
 * A smooth line through the points that never overshoots them (monotone
 * cubic interpolation), so a week of zero never dips below the axis.
 */
function smoothLine(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 2) return "";
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    slope.push((points[i + 1].y - points[i].y) / (points[i + 1].x - points[i].x));
  }
  const tangent = points.map((_, i) => {
    if (i === 0) return slope[0];
    if (i === n - 1) return slope[n - 2];
    return slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  });
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i] / slope[i];
    const b = tangent[i + 1] / slope[i];
    const size = Math.hypot(a, b);
    if (size > 3) {
      tangent[i] = (3 / size) * a * slope[i];
      tangent[i + 1] = (3 / size) * b * slope[i];
    }
  }
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const third = (points[i + 1].x - points[i].x) / 3;
    d +=
      `C${round(points[i].x + third)} ${round(points[i].y + tangent[i] * third)} ` +
      `${round(points[i + 1].x - third)} ${round(points[i + 1].y - tangent[i + 1] * third)} ` +
      `${points[i + 1].x} ${points[i + 1].y}`;
  }
  return d;
}

export function AnalyticsDemo() {
  const { t } = useMotion();
  const visual = useRef<HTMLDivElement>(null);
  const entered = useEntered(visual);
  const [plot, width] = useWidth<HTMLDivElement>();
  const id = useId();
  const [key, setKey] = useState<MetricKey>("delivered");
  const [week, setWeek] = useState<number | null>(null);

  const metric = METRICS.find((m) => m.key === key) ?? METRICS[0];
  const figure = week === null ? summarise(metric) : metric.weeks[week];

  const points = width > 0 ? plotPoints(metric.weeks, width) : [];
  const line = smoothLine(points);
  const area = `${line}L${width} ${CHART_HEIGHT}L0 ${CHART_HEIGHT}Z`;
  const marked = points[week ?? WEEKS - 1];

  const weekAt = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - box.left) / box.width) * (WEEKS - 1));
    setWeek(Math.min(WEEKS - 1, Math.max(0, i)));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const current = week ?? WEEKS - 1;
    const next =
      e.key === "ArrowLeft" || e.key === "ArrowDown"
        ? Math.max(0, week === null ? WEEKS - 2 : current - 1)
        : e.key === "ArrowRight" || e.key === "ArrowUp"
          ? Math.min(WEEKS - 1, current + 1)
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? WEEKS - 1
              : null;
    if (e.key === "Escape") {
      setWeek(null);
    } else if (next !== null) {
      e.preventDefault();
      setWeek(next);
    }
  };

  return (
    <Visual ref={visual} className="h-[344px]">
      <Panel className="overflow-hidden">
        <ChoiceGroup
          label="Metric to chart"
          value={key}
          onChange={setKey}
          options={METRICS.map((m) => ({
            value: m.key,
            name: `${m.label}: ${formatMetric(summarise(m), m.unit)}`,
            label: (
              <>
                <span className="block text-[10px] tracking-tight whitespace-nowrap text-neutral-500 @lg:text-[11px] @lg:tracking-normal">
                  {m.label}
                </span>
                <span className="mt-1 block text-[13px] leading-none font-semibold text-neutral-950 tabular-nums @lg:text-[15px]">
                  {formatMetric(summarise(m), m.unit)}
                </span>
              </>
            ),
          }))}
          className="grid grid-cols-5 border-b border-neutral-200"
          itemClassName={(selected) =>
            cn(
              "relative min-w-0 border-l border-neutral-200 px-1.5 py-2.5 text-left transition-[background-color] duration-150 first:border-l-0 focus-visible:outline-offset-[-2px] @lg:px-3.5 @lg:py-3",
              "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-neutral-950 after:transition-opacity after:duration-150",
              selected
                ? "bg-white after:opacity-100"
                : "bg-neutral-50/80 after:opacity-0 hover:bg-neutral-50/30",
            )
          }
        />

        <div className="px-3 pt-3.5 pb-2.5 @lg:px-5 @lg:pt-4">
          <p className="flex items-baseline gap-2">
            <span
              className="text-2xl leading-none font-semibold tracking-tight text-neutral-950 tabular-nums"
              style={displayFont}
            >
              {formatMetric(figure, metric.unit)}
            </span>
            <span className="truncate text-xs text-neutral-500">
              {metric.noun}
              {week === null ? ", last 12 weeks" : `, week ${week + 1} of 12`}
            </span>
          </p>

          <div
            ref={plot}
            role="slider"
            tabIndex={0}
            aria-label={`${metric.label} by week, example data`}
            aria-valuemin={1}
            aria-valuemax={WEEKS}
            aria-valuenow={(week ?? WEEKS - 1) + 1}
            aria-valuetext={`Week ${(week ?? WEEKS - 1) + 1} of ${WEEKS}: ${formatMetric(
              metric.weeks[week ?? WEEKS - 1],
              metric.unit,
            )} ${metric.noun}`}
            onPointerMove={weekAt}
            onPointerDown={weekAt}
            onPointerLeave={() => setWeek(null)}
            onKeyDown={onKeyDown}
            onBlur={() => setWeek(null)}
            className={cn("relative mt-1 cursor-crosshair touch-pan-y rounded-md", focusRing)}
            style={{ height: CHART_HEIGHT }}
          >
            {width > 0 && (
              <svg
                width={width}
                height={CHART_HEIGHT}
                className="absolute inset-0 overflow-visible"
                fill="none"
                aria-hidden
              >
                <defs>
                  <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={VIOLET} stopOpacity="0.22" />
                    <stop offset="1" stopColor={VIOLET} stopOpacity="0" />
                  </linearGradient>
                  <clipPath id={`${id}-reveal`}>
                    <motion.rect
                      x={-6}
                      y={0}
                      height={CHART_HEIGHT}
                      initial={{ width: 0 }}
                      animate={{ width: entered ? width + 12 : 0 }}
                      transition={t(0.9, 0.1)}
                    />
                  </clipPath>
                </defs>

                {[CHART_TOP, (CHART_TOP + CHART_HEIGHT) / 2].map((y) => (
                  <path key={y} d={`M0 ${y}H${width}`} stroke="#e5e5e5" strokeDasharray="2 4" />
                ))}
                <path d={`M0 ${CHART_HEIGHT - 0.5}H${width}`} stroke="#e5e5e5" />

                <g clipPath={`url(#${id}-reveal)`}>
                  <motion.path
                    fill={`url(#${id}-fill)`}
                    initial={false}
                    animate={{ d: area }}
                    transition={t(0.5)}
                  />
                  <motion.path
                    stroke={VIOLET}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={false}
                    animate={{ d: line }}
                    transition={t(0.5)}
                  />
                </g>

                {/* The week being read: a rule, and a dot on the line. */}
                <motion.path
                  d={`M0 ${CHART_TOP - 8}V${CHART_HEIGHT}`}
                  stroke="#a3a3a3"
                  strokeDasharray="2 3"
                  initial={false}
                  animate={{ x: marked.x, opacity: week === null ? 0 : 1 }}
                  transition={t(0.18)}
                />
                <motion.circle
                  r={4}
                  fill="white"
                  stroke={VIOLET}
                  strokeWidth={2}
                  initial={false}
                  animate={{ cx: marked.x, cy: marked.y, opacity: entered ? 1 : 0 }}
                  transition={{ ...t(0.18), opacity: t(0.3, 0.9) }}
                />
              </svg>
            )}

            {width > 0 && week !== null && (
              <span
                aria-hidden
                style={{ left: Math.min(width - 44, Math.max(44, marked.x)) }}
                className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md bg-neutral-950 px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-white tabular-nums shadow-[0_4px_12px_-2px_rgba(0,0,0,0.25)] transition-[left] duration-150 ease-out"
              >
                <span className="font-normal text-neutral-400">Week {week + 1}</span>{" "}
                {formatMetric(metric.weeks[week], metric.unit)}
              </span>
            )}
          </div>

          <div className="mt-2 flex justify-between text-[11px] text-neutral-500">
            <span>12 weeks ago</span>
            <span>This week</span>
          </div>
        </div>
      </Panel>
    </Visual>
  );
}

// ─── Schedule ────────────────────────────────────────────────────────────────
//
// Pick a day and a time; the clock's hands follow the time. Scheduling draws
// a ring round the clock, and Cancel takes it off again.

const DAYS = [
  { value: "Mon", label: "Mon", name: "Monday" },
  { value: "Tue", label: "Tue", name: "Tuesday" },
  { value: "Wed", label: "Wed", name: "Wednesday" },
  { value: "Thu", label: "Thu", name: "Thursday" },
  { value: "Fri", label: "Fri", name: "Friday" },
];

// Hand angles in degrees. They only ever grow with the time, so choosing a
// later time turns the hands forwards and an earlier one turns them back.
const TIMES = [
  { value: "08:00", label: "08:00", hour: 240, minute: 0 },
  { value: "09:30", label: "09:30", hour: 285, minute: 180 },
  { value: "12:00", label: "12:00", hour: 360, minute: 360 },
  { value: "17:30", label: "17:30", hour: 525, minute: 540 },
];

function hand(degrees: number): React.CSSProperties {
  return {
    transform: `rotate(${degrees}deg)`,
    transformBox: "view-box",
    transformOrigin: "44px 44px",
    transition: "transform 600ms cubic-bezier(0.22, 1, 0.36, 1)",
  };
}

export function ScheduleDemo() {
  const { t } = useMotion();
  const [day, setDay] = useState("Tue");
  const [time, setTime] = useState("09:30");
  const [scheduled, setScheduled] = useState(false);

  const dayName = DAYS.find((d) => d.value === day)?.name ?? day;
  const angles = TIMES.find((item) => item.value === time) ?? TIMES[1];

  return (
    <Visual className="h-[344px]">
      <div className="flex items-center gap-2 text-[13px]">
        <CalendarClock className="size-3.5 shrink-0 text-neutral-500" aria-hidden />
        <span className="truncate font-medium text-neutral-900">April newsletter</span>
        <StatusPill tone={scheduled ? "accent" : "neutral"} className="ml-auto">
          {scheduled ? "Scheduled" : "Draft"}
        </StatusPill>
      </div>

      <div className="flex flex-1 items-center gap-5">
        <svg
          viewBox="0 0 88 88"
          className="size-[88px] shrink-0 drop-shadow-[0_6px_10px_rgba(0,0,0,0.07)]"
          fill="none"
          aria-hidden
        >
          <circle cx="44" cy="44" r="40" fill="white" stroke="#e5e5e5" />
          {Array.from({ length: 12 }, (_, i) => (
            <path
              key={i}
              d={i % 3 === 0 ? "M44 9v6" : "M44 9v3"}
              stroke={i % 3 === 0 ? "#737373" : "#d4d4d4"}
              strokeWidth={1.5}
              strokeLinecap="round"
              transform={`rotate(${i * 30} 44 44)`}
            />
          ))}
          {/* Drawn round the face from 12 o'clock once the send is scheduled. */}
          <motion.circle
            cx="44"
            cy="44"
            r="42.5"
            stroke={VIOLET}
            strokeWidth={2}
            strokeLinecap="round"
            transform="rotate(-90 44 44)"
            initial={false}
            animate={{ pathLength: scheduled ? 1 : 0, opacity: scheduled ? 1 : 0 }}
            transition={t(scheduled ? 0.6 : 0.25)}
          />
          <g style={hand(angles.hour)}>
            <path d="M44 44V25" stroke="#171717" strokeWidth={3} strokeLinecap="round" />
          </g>
          <g style={hand(angles.minute)}>
            <path d="M44 44V16" stroke="#171717" strokeWidth={2} strokeLinecap="round" />
          </g>
          <circle cx="44" cy="44" r="3" fill={VIOLET} stroke="white" strokeWidth={1.5} />
        </svg>

        <p className="min-w-0" aria-live="polite">
          <span className="block text-xs text-neutral-500">
            {scheduled ? "Sends on" : "Send on"}
          </span>
          <span
            className="mt-1 block text-[22px] leading-[1.1] font-semibold tracking-tight text-neutral-950"
            style={displayFont}
          >
            {dayName}
            <span className="sr-only"> at </span>
            <span className="block text-neutral-400 tabular-nums">{time}</span>
          </span>
        </p>
      </div>

      <ChoiceGroup
        label="Day to send"
        value={day}
        onChange={setDay}
        options={DAYS}
        className="grid grid-cols-5 gap-1.5"
        itemClassName={chips.item}
      />
      <ChoiceGroup
        label="Time to send"
        value={time}
        onChange={setTime}
        options={TIMES}
        className="mt-1.5 grid grid-cols-4 gap-1.5"
        itemClassName={chips.item}
      />

      <DemoButton
        variant={scheduled ? "secondary" : "primary"}
        className="mt-3 mb-1 w-full"
        onClick={() => setScheduled((value) => !value)}
      >
        {scheduled ? "Cancel" : "Schedule"}
      </DemoButton>
    </Visual>
  );
}

// ─── Automations ─────────────────────────────────────────────────────────────
//
// A welcome flow: trigger, delay, condition, then one of two emails. Adding
// a test contact walks it down the flow one step at a time, and the
// condition sends it left or right depending on its address. Once it has
// arrived, a pulse keeps travelling the route it took while the cell is on
// screen.

type Branch = "yes" | "no";

const CONTACTS: { email: string; branch: Branch; outcome: string }[] = [
  { email: "mina@example.org", branch: "yes", outcome: "the staff welcome" },
  { email: "tom@example.com", branch: "no", outcome: "the member welcome" },
];

// The flow is drawn on a 320 × 212 board: nodes are 32px tall and the
// connectors below are written against the same numbers.
const FLOW = {
  trunk: ["M160 32V52", "M160 84V104"],
  yes: "M160 136V148Q160 158 150 158H87Q77 158 77 168V180",
  no: "M160 136V148Q160 158 170 158H233Q243 158 243 168V180",
  // The whole way a contact travels, for the pulse. It runs behind the nodes.
  route: {
    yes: "M160 16V148Q160 158 150 158H87Q77 158 77 168V196",
    no: "M160 16V148Q160 158 170 158H233Q243 158 243 168V196",
  },
};

function FlowNode({
  icon: Icon,
  text,
  active,
  done,
  className,
  style,
}: {
  icon: LucideIcon;
  text: React.ReactNode;
  active: boolean;
  done?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={cn(
        "absolute flex h-8 items-center gap-2 rounded-lg border bg-white pr-2.5 pl-1.5 text-xs whitespace-nowrap transition-[border-color,box-shadow] duration-300",
        active
          ? "border-[#6C5ED1]/60 shadow-[0_0_0_3px_rgba(108,94,209,0.12),0_2px_4px_-2px_rgba(0,0,0,0.05)]"
          : "border-neutral-200 shadow-[0_1px_1px_rgba(0,0,0,0.03),0_2px_4px_-2px_rgba(0,0,0,0.05)]",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-[5px] transition-colors duration-300",
          active ? "bg-[#6C5ED1] text-white" : "bg-neutral-100 text-neutral-500",
        )}
      >
        {done ? (
          <Check className="size-3" strokeWidth={3} aria-hidden />
        ) : (
          <Icon className="size-3" aria-hidden />
        )}
      </span>
      <span className="min-w-0 truncate font-medium text-neutral-900">{text}</span>
    </div>
  );
}

export function AutomationDemo() {
  const { reduce, t } = useMotion();
  const visual = useRef<HTMLDivElement>(null);
  const entered = useEntered(visual);
  const onScreen = useOnScreen(visual);
  // 0 nothing run, 1 trigger, 2 delay, 3 condition, 4 email sent.
  const [step, setStep] = useState(0);
  const [contact, setContact] = useState<(typeof CONTACTS)[number] | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clear, []);

  const run = (next: (typeof CONTACTS)[number]) => {
    clear();
    setContact(next);
    if (reduce) {
      setStep(4);
      return;
    }
    setStep(1);
    timers.current = [2, 3, 4].map((target, i) =>
      setTimeout(() => setStep(target), (i + 1) * 420),
    );
  };

  const branch = contact?.branch ?? null;
  const sentTo = (side: Branch) => step >= 4 && branch === side;

  return (
    <Visual ref={visual} backdrop="dots" className="h-[348px]">
      <div className="flex justify-center gap-1.5" role="group" aria-label="Add a test contact">
        {CONTACTS.map((item) => (
          <button
            key={item.email}
            type="button"
            onClick={() => run(item)}
            aria-label={`Add ${item.email} as a test contact`}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg border bg-white px-2.5 text-xs font-medium whitespace-nowrap sm:h-8",
              "transition-[border-color,color,transform,box-shadow] duration-150 ease-out active:scale-[0.97]",
              contact?.email === item.email
                ? "border-[#6C5ED1]/60 text-[#4f41b8] shadow-[0_0_0_3px_rgba(108,94,209,0.10)]"
                : "border-neutral-200 text-neutral-700 shadow-[0_1px_1px_rgba(0,0,0,0.03),0_2px_4px_-2px_rgba(0,0,0,0.05)] hover:border-neutral-300 hover:text-neutral-950",
              focusRing,
            )}
          >
            <UserPlus className="size-3.5" aria-hidden />
            {item.email}
          </button>
        ))}
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="relative h-[212px] w-[320px] shrink-0" aria-hidden>
          <svg width="320" height="212" className="absolute inset-0" fill="none">
            {[...FLOW.trunk, FLOW.yes, FLOW.no].map((d, i) => (
              <motion.path
                key={d}
                d={d}
                stroke="#cfcfcf"
                strokeWidth={1.25}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: entered ? 1 : 0 }}
                transition={t(0.5, 0.1 + Math.min(i, 2) * 0.14)}
              />
            ))}
            {FLOW.trunk.map((d, i) => (
              <motion.path
                key={`lit-${d}`}
                d={d}
                stroke={VIOLET}
                strokeWidth={1.5}
                initial={false}
                animate={{ pathLength: step >= i + 2 ? 1 : 0, opacity: step >= i + 2 ? 1 : 0 }}
                transition={t(0.3)}
              />
            ))}
            {(["yes", "no"] as const).map((side) => (
              <motion.path
                key={`lit-${side}`}
                d={FLOW[side]}
                stroke={VIOLET}
                strokeWidth={1.5}
                initial={false}
                animate={{ pathLength: sentTo(side) ? 1 : 0, opacity: sentTo(side) ? 1 : 0 }}
                transition={t(0.4)}
              />
            ))}
            {/* The contact, still travelling the route it took. */}
            {step >= 4 && branch && onScreen && !reduce && (
              <motion.path
                key={branch}
                d={FLOW.route[branch]}
                pathLength={100}
                stroke={VIOLET}
                strokeWidth={3.5}
                strokeLinecap="round"
                strokeDasharray="0.1 200"
                initial={{ strokeDashoffset: 0, opacity: 0 }}
                animate={{ strokeDashoffset: -100, opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: 2.4,
                  ease: "linear",
                  repeat: Infinity,
                  repeatDelay: 1.2,
                  delay: 0.8,
                  opacity: {
                    duration: 2.4,
                    times: [0, 0.08, 0.9, 1],
                    repeat: Infinity,
                    repeatDelay: 1.2,
                    delay: 0.8,
                  },
                }}
              />
            )}
          </svg>

          {(["yes", "no"] as const).map((side) => (
            <span
              key={side}
              style={{ left: side === "yes" ? 118 : 202, top: 158 }}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border bg-white px-1.5 text-[10px] leading-4 font-medium transition-colors duration-300",
                sentTo(side)
                  ? "border-[#6C5ED1]/50 text-[#4f41b8]"
                  : "border-neutral-200 text-neutral-500",
              )}
            >
              {side === "yes" ? "Yes" : "No"}
            </span>
          ))}

          <FlowNode
            icon={Zap}
            text="Contact added"
            active={step >= 1}
            className="left-1/2 -translate-x-1/2"
            style={{ top: 0 }}
          />
          <FlowNode
            icon={Clock}
            text="Wait 1 day"
            active={step >= 2}
            className="left-1/2 -translate-x-1/2"
            style={{ top: 52 }}
          />
          <FlowNode
            icon={GitBranch}
            text="Email ends with example.org"
            active={step >= 3}
            className="left-1/2 -translate-x-1/2"
            style={{ top: 104 }}
          />
          {(["yes", "no"] as const).map((side) => (
            <FlowNode
              key={side}
              icon={Mail}
              text={side === "yes" ? "Staff welcome" : "Member welcome"}
              active={sentTo(side)}
              done={sentTo(side)}
              className="-translate-x-1/2"
              style={{ top: 180, left: side === "yes" ? 77 : 243 }}
            />
          ))}
        </div>
      </div>

      <p className="min-h-5 pb-1 text-center text-xs text-neutral-500" aria-live="polite">
        {step >= 4 && contact
          ? `${contact.email} gets ${contact.outcome} a day later.`
          : step > 0
            ? "Running…"
            : "Add a contact to run the flow."}
      </p>
    </Visual>
  );
}

// ─── Signup forms ────────────────────────────────────────────────────────────
//
// One form, three ways to put it on a site. The page behind it is a sketch;
// the choice moves the form between sitting in the page, opening over it,
// and sliding into a corner.

type FormKind = "static" | "popup" | "slide";

const FORM_KINDS: { value: FormKind; label: string; about: string }[] = [
  { value: "static", label: "In the page", about: "The form sits in the page as a section." },
  { value: "popup", label: "Popup", about: "The form opens over the page." },
  { value: "slide", label: "Slide-in", about: "The form slides into the corner of the page." },
];

function SignupForm({ compact = false, closable = false }: { compact?: boolean; closable?: boolean }) {
  return (
    <div className="relative">
      {closable && <X className="absolute -top-0.5 -right-0.5 size-3 text-neutral-400" />}
      <p className="text-xs font-semibold text-neutral-900">Northfield Arts news</p>
      {!compact && (
        <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
          One email a month. Leave whenever you like.
        </p>
      )}
      <div className="mt-2 flex gap-1.5">
        <span className="flex h-7 min-w-0 flex-1 items-center truncate rounded-md border border-neutral-200 bg-white px-2 text-[11px] text-neutral-400 shadow-[inset_0_1px_1px_rgba(0,0,0,0.03)]">
          you@example.com
        </span>
        <span className="flex h-7 shrink-0 items-center rounded-md bg-[#6C5ED1] px-2.5 text-[11px] font-medium text-white shadow-[0_1px_2px_rgba(108,94,209,0.4)]">
          Subscribe
        </span>
      </div>
    </div>
  );
}

function PageLines({ widths }: { widths: string[] }) {
  return (
    <div className="flex flex-col gap-2">
      {widths.map((width, i) => (
        <span key={i} className={cn("h-1.5 rounded-full bg-neutral-100", width)} />
      ))}
    </div>
  );
}

export function FormsDemo() {
  const { t } = useMotion();
  const [kind, setKind] = useState<FormKind>("static");

  return (
    <Visual className="h-[348px]">
      <ChoiceGroup
        label="How the form appears"
        value={kind}
        onChange={setKind}
        options={FORM_KINDS}
        className={cn(segmented.group, "mx-auto")}
        itemClassName={segmented.item}
      />

      {/* A browser window that runs off the bottom of the cell. */}
      <div
        className={cn(
          "relative mx-auto mt-4 flex w-full max-w-[440px] flex-1 flex-col overflow-hidden rounded-t-xl border-b-0",
          "[mask-image:linear-gradient(to_bottom,black_calc(100%-40px),transparent)]",
          cardSurface,
        )}
        aria-hidden
      >
        <div className="flex h-9 shrink-0 items-center gap-3 border-b border-neutral-200 px-3">
          <span className="flex gap-1">
            {[0, 1, 2].map((dot) => (
              <span key={dot} className="size-2 rounded-full bg-neutral-200" />
            ))}
          </span>
          <span className="flex h-5 min-w-0 flex-1 items-center gap-1.5 rounded-md bg-neutral-100 px-2 text-[10.5px] text-neutral-500">
            <Lock className="size-2.5 shrink-0" />
            <span className="truncate">northfieldarts.example.org/news</span>
          </span>
        </div>

        <div className="relative flex-1 overflow-hidden px-4 pt-3.5">
          <div className="flex items-center gap-2">
            <span className="size-3.5 rounded-[4px] bg-[#6C5ED1]" />
            <span className="h-1.5 w-16 rounded-full bg-neutral-200" />
            <span className="ml-auto h-1.5 w-6 rounded-full bg-neutral-100" />
            <span className="h-1.5 w-6 rounded-full bg-neutral-100" />
            <span className="h-1.5 w-6 rounded-full bg-neutral-100" />
          </div>
          <span className="mt-4 block h-2.5 w-2/5 rounded-full bg-neutral-200" />
          <div className="mt-3">
            <PageLines widths={["w-full", "w-11/12", "w-4/5"]} />
          </div>

          <AnimatePresence initial={false} mode="popLayout">
            {kind === "static" && (
              <motion.div
                key="static"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={t(0.3)}
                className="mt-3.5 rounded-lg border border-neutral-200 bg-neutral-50 p-3"
              >
                <SignupForm />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-3.5">
            <PageLines widths={["w-full", "w-3/4", "w-full", "w-5/6", "w-2/3", "w-full", "w-1/2", "w-11/12", "w-3/5"]} />
          </div>

          <AnimatePresence initial={false}>
            {kind === "popup" && (
              <motion.div
                key="popup"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={t(0.3)}
                className="absolute inset-0 flex items-center justify-center bg-neutral-900/25 px-4 pb-8"
              >
                <motion.div
                  initial={{ scale: 0.94, y: 6 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.97 }}
                  transition={t(0.3)}
                  className="w-full max-w-[272px] rounded-xl border border-neutral-200 bg-white p-3.5 shadow-[0_2px_4px_rgba(0,0,0,0.04),0_16px_36px_-8px_rgba(0,0,0,0.28)]"
                >
                  <SignupForm closable />
                </motion.div>
              </motion.div>
            )}
            {kind === "slide" && (
              <motion.div
                key="slide"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={t(0.35)}
                className="absolute right-3 bottom-12 w-[236px] max-w-[calc(100%-1.5rem)] rounded-xl border border-neutral-200 bg-white p-3 shadow-[0_2px_4px_rgba(0,0,0,0.04),0_12px_28px_-8px_rgba(0,0,0,0.22)]"
              >
                <SignupForm compact closable />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {FORM_KINDS.find((item) => item.value === kind)?.about}
      </p>
    </Visual>
  );
}

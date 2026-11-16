"use client";

import { useRef, useState } from "react";
import { LayoutGroup, motion } from "motion/react";
import { Check, FileSpreadsheet, Folder } from "lucide-react";

import { cn } from "@/lib/utils";

import { displayFont } from "../landing-ui";
import {
  ChoiceGroup,
  CountUp,
  DemoButton,
  EASE_OUT,
  StatusPill,
  Tick,
  VIOLET,
  Visual,
  cardSurface,
  segmented,
  useEntered,
  useMotion,
} from "./features-kit";

// The three audience cells share a row, so they share a height.
const ROW_VISUAL = "h-[336px]";

// ─── Import ──────────────────────────────────────────────────────────────────
//
// The top of a spreadsheet with its two columns already matched to Email and
// Name. Importing checks the rows from the top: good ones get a tick, the
// repeated address and the malformed one are struck out, and the totals are
// the same three numbers the real import ends on.

const IMPORT_ROWS = 512;
const IMPORT_RESULT = [
  { label: "Imported", value: 506 },
  { label: "Duplicates", value: 4 },
  { label: "Invalid", value: 2 },
];

type RowVerdict = "ok" | "duplicate" | "invalid";

const SHEET: { name: string; email: string; verdict: RowVerdict }[] = [
  { name: "Amara Nwosu", email: "amara@example.com", verdict: "ok" },
  { name: "Dele Okafor", email: "d.okafor@example.org", verdict: "ok" },
  { name: "Amara Nwosu", email: "amara@example.com", verdict: "duplicate" },
  { name: "Jo Lind", email: "jo.lind.example.com", verdict: "invalid" },
  { name: "Priya Shah", email: "priya@example.org", verdict: "ok" },
];

// Seconds between one row being checked and the next.
const ROW_STEP = 0.1;

export function ImportDemo() {
  const { reduce } = useMotion();
  const [done, setDone] = useState(false);

  return (
    <Visual className={ROW_VISUAL}>
      {/* The sheet runs on past what is shown, so it fades out at the bottom. */}
      <div
        className={cn(
          "relative overflow-hidden rounded-t-xl border-b-0 text-xs [mask-image:linear-gradient(to_bottom,black_calc(100%-26px),transparent)]",
          cardSurface,
        )}
      >
        <div className="flex h-8 items-center gap-2 border-b border-neutral-200 px-3">
          <FileSpreadsheet className="size-3.5 shrink-0 text-emerald-600" aria-hidden />
          <span className="truncate text-[13px] font-medium text-neutral-900">members.xlsx</span>
          <span className="ml-auto shrink-0 text-neutral-500 tabular-nums">{IMPORT_ROWS} rows</span>
        </div>

        <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,8fr)] border-b border-neutral-200 bg-neutral-50/70 px-3 py-1.5">
          {[
            ["Full Name", "Name"],
            ["E-mail Address", "Email"],
          ].map(([column, field]) => (
            <p key={field} className="min-w-0 pr-2 leading-tight">
              <span className="block truncate text-[10.5px] text-neutral-500">{column}</span>
              <span className="mt-0.5 flex items-center gap-1 font-medium text-[#4f41b8]">
                <svg viewBox="0 0 12 12" className="size-2.5 shrink-0" fill="none" aria-hidden>
                  <path
                    d="M2 1.5v4.25a2 2 0 0 0 2 2h6M7.75 5.5 10 7.75 7.75 10"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="sr-only">matched to</span>
                {field}
              </span>
            </p>
          ))}
        </div>

        <div className="relative">
          {/* The check passing down the rows. */}
          {done && !reduce && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-[26px] bg-[linear-gradient(to_bottom,transparent,rgba(108,94,209,0.10))]"
              initial={{ y: -26, opacity: 0 }}
              animate={{ y: SHEET.length * 26, opacity: [0, 1, 1, 0] }}
              transition={{ duration: SHEET.length * ROW_STEP + 0.15, ease: "linear" }}
            />
          )}
          <ul>
            {SHEET.map((row, i) => {
              const ok = row.verdict === "ok";
              const out = done && !ok;
              const delay = done ? `${Math.round(i * ROW_STEP * 1000)}ms` : "0ms";
              return (
                <li
                  key={i}
                  className="grid h-[26px] grid-cols-[minmax(0,5fr)_minmax(0,8fr)] items-center border-b border-neutral-100 px-3"
                >
                  <span
                    style={{ transitionDelay: delay }}
                    className={cn(
                      "truncate pr-2 transition-colors duration-200",
                      out ? "text-neutral-400" : "text-neutral-800",
                    )}
                  >
                    {row.name}
                  </span>
                  <span className="relative flex min-w-0 items-center gap-1.5">
                    <span
                      style={{ transitionDelay: delay }}
                      className={cn(
                        "truncate decoration-neutral-300 transition-colors duration-200",
                        out ? "text-neutral-400 line-through" : "text-neutral-600",
                      )}
                    >
                      {row.email}
                    </span>
                    {ok ? (
                      <Tick on={done} size={14} delay={i * ROW_STEP} className="ml-auto" />
                    ) : (
                      <span
                        style={{ transitionDelay: delay }}
                        className={cn(
                          "absolute right-0 flex h-full items-center bg-[linear-gradient(to_right,transparent,white_14px)] pl-5 transition-opacity duration-200",
                          done ? "opacity-100" : "opacity-0",
                        )}
                        aria-hidden={!done}
                      >
                        <StatusPill
                          tone={row.verdict === "duplicate" ? "warning" : "danger"}
                          className="px-1.5 text-[10px]"
                        >
                          {row.verdict === "duplicate" ? "Duplicate" : "Invalid"}
                        </StatusPill>
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <dl className="mt-2.5 grid grid-cols-3" aria-live="polite">
        {IMPORT_RESULT.map((stat, i) => (
          <div key={stat.label} className={cn(i > 0 && "border-l border-neutral-200 pl-3")}>
            <dt className="text-[11px] text-neutral-500">{stat.label}</dt>
            <dd
              className={cn(
                "mt-1 text-xl leading-none font-semibold tracking-tight transition-colors duration-300",
                done ? "text-neutral-950" : "text-neutral-300",
              )}
              style={displayFont}
            >
              <CountUp value={done ? stat.value : 0} duration={0.9} />
            </dd>
          </div>
        ))}
      </dl>

      <DemoButton
        variant={done ? "secondary" : "primary"}
        className="mt-auto mb-1 w-full"
        onClick={() => setDone((value) => !value)}
      >
        {done ? "Reset" : `Import ${IMPORT_ROWS} rows`}
      </DemoButton>
    </Visual>
  );
}

// ─── Folders ─────────────────────────────────────────────────────────────────
//
// Tick folders and the recipient count follows. People in more than one of
// the chosen folders are counted once, because a campaign holds each address
// once however many folders it came from. The circles are the folders, drawn
// overlapping because their people do.

const FOLDERS = [
  { key: "m", name: "Members", count: 1240, cx: 112, cy: 68, r: 56, tx: 86, ty: 72 },
  { key: "v", name: "Volunteers", count: 86, cx: 160, cy: 100, r: 22, tx: 169, ty: 107 },
  { key: "e", name: "Event attendees", count: 312, cx: 168, cy: 44, r: 34, tx: 177, ty: 42 },
] as const;

type FolderKey = (typeof FOLDERS)[number]["key"];

// Distinct people for each combination of folders (keys in m, v, e order).
const DISTINCT: Record<string, number> = {
  "": 0,
  m: 1240,
  v: 86,
  e: 312,
  mv: 1272,
  me: 1404,
  ve: 386,
  mve: 1433,
};

export function FoldersDemo() {
  const { t } = useMotion();
  const visual = useRef<HTMLDivElement>(null);
  const entered = useEntered(visual);
  const [picked, setPicked] = useState<FolderKey[]>(["m"]);
  const [hot, setHot] = useState<FolderKey | null>(null);

  const chosen = FOLDERS.filter((folder) => picked.includes(folder.key));
  const people = DISTINCT[chosen.map((folder) => folder.key).join("")];
  const overlap = chosen.reduce((sum, folder) => sum + folder.count, 0) - people;

  const toggle = (key: FolderKey) =>
    setPicked((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <Visual ref={visual} className={ROW_VISUAL}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 pt-1">
          <p className="text-xs text-neutral-500">Sending to</p>
          <p className="mt-1.5" aria-live="polite">
            <CountUp
              value={people}
              className="block text-[32px] leading-none font-semibold tracking-tight text-neutral-950 [font-family:var(--font-bricolage,var(--font-inter))]"
            />
            <span className="mt-1 block text-xs text-neutral-500">
              {people === 1 ? "person" : "people"}
            </span>
          </p>
        </div>

        <svg viewBox="52 8 152 120" className="h-[132px] w-[167px] shrink-0" aria-hidden>
          {FOLDERS.map((folder, i) => {
            const on = picked.includes(folder.key);
            return (
              <g key={folder.key}>
                <motion.circle
                  cx={folder.cx}
                  cy={folder.cy}
                  r={folder.r}
                  fill={VIOLET}
                  initial={false}
                  animate={{ fillOpacity: on ? 0.14 : 0 }}
                  transition={t(0.3)}
                />
                <motion.circle
                  cx={folder.cx}
                  cy={folder.cy}
                  r={folder.r}
                  fill="none"
                  stroke={on ? VIOLET : "#c4c4c4"}
                  strokeWidth={hot === folder.key ? 2 : 1.25}
                  strokeDasharray={on ? undefined : "3 3.5"}
                  className="transition-[stroke,stroke-width] duration-200"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: entered ? 1 : 0, scale: entered ? 1 : 0.85 }}
                  transition={t(0.5, i * 0.08)}
                />
                <text
                  x={folder.tx}
                  y={folder.ty}
                  textAnchor="middle"
                  className={cn(
                    "text-[10px] tabular-nums transition-colors duration-200",
                    on ? "fill-[#4f41b8] font-medium" : "fill-neutral-400",
                  )}
                >
                  {folder.count.toLocaleString("en-GB")}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <fieldset className="-mx-2 mt-3">
        <legend className="sr-only">Folders to send to</legend>
        {FOLDERS.map((folder) => {
          const on = picked.includes(folder.key);
          return (
            <label
              key={folder.key}
              onPointerEnter={() => setHot(folder.key)}
              onPointerLeave={() => setHot((current) => (current === folder.key ? null : current))}
              className={cn(
                "flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-[13px] transition-colors duration-150 hover:bg-neutral-50",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[-2px] has-[:focus-visible]:outline-[#6c5ed1]",
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={on}
                onChange={() => toggle(folder.key)}
                onFocus={() => setHot(folder.key)}
                onBlur={() => setHot((current) => (current === folder.key ? null : current))}
              />
              <span
                aria-hidden
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-[background-color,border-color,box-shadow] duration-150",
                  on
                    ? "border-[#6C5ED1] bg-[#6C5ED1] text-white shadow-[0_1px_2px_rgba(108,94,209,0.4)]"
                    : "border-neutral-300 bg-white text-transparent shadow-[0_1px_1px_rgba(0,0,0,0.04)]",
                )}
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
              <Folder
                className={cn(
                  "size-3.5 shrink-0 transition-colors duration-150",
                  on ? "text-[#6C5ED1]" : "text-neutral-400",
                )}
                aria-hidden
              />
              <span
                className={cn("min-w-0 truncate", on ? "font-medium text-neutral-900" : "text-neutral-600")}
              >
                {folder.name}
              </span>
              <span className="ml-auto shrink-0 text-xs text-neutral-500 tabular-nums">
                {folder.count.toLocaleString("en-GB")}
              </span>
            </label>
          );
        })}
      </fieldset>

      <p
        className="mt-auto border-t border-dashed border-neutral-200 pt-3 pb-1 text-xs text-neutral-500"
        aria-live="polite"
      >
        {chosen.length === 0
          ? "Tick a folder to add its contacts."
          : overlap > 0
            ? `${overlap} are in more than one folder. Counted once.`
            : "Everyone in this folder."}
      </p>
    </Visual>
  );
}

// ─── Suppression ─────────────────────────────────────────────────────────────
//
// The same four addresses across two sends. In March two of them fail; by
// April they are on the suppression list and the send goes round them. The
// rows keep their identity between the lists, so they slide across.

type Send = "march" | "april";

const PEOPLE = [
  { email: "amara@example.com", march: "Delivered" },
  { email: "d.okafor@example.org", march: "Hard bounce" },
  { email: "jo.lind@example.com", march: "Delivered" },
  { email: "press@example.org", march: "Complaint" },
] as const;

const DOT: Record<string, string> = {
  Delivered: "bg-emerald-500",
  "Hard bounce": "bg-red-500",
  Complaint: "bg-amber-500",
};

const slide = { duration: 0.45, ease: EASE_OUT };

export function SuppressionDemo() {
  const { t } = useMotion();
  const [send, setSend] = useState<Send>("march");

  const failed = PEOPLE.filter((person) => person.march !== "Delivered");
  const suppressed = send === "march" ? [] : failed;
  const landed = suppressed.length > 0;

  return (
    <Visual className={ROW_VISUAL}>
      <ChoiceGroup
        label="Which send to look at"
        value={send}
        onChange={setSend}
        options={[
          { value: "march", label: "March send" },
          { value: "april", label: "April send" },
        ]}
        className={cn(segmented.group, "grid w-full grid-cols-2")}
        itemClassName={segmented.item}
      />

      <LayoutGroup>
        <ul aria-label="Recipients" className="mt-3">
          {PEOPLE.map((person) => {
            const skipped = send === "april" && person.march !== "Delivered";
            return (
              <li key={person.email} className="relative h-7 text-xs">
                {/* The slot an address leaves behind once it is suppressed. */}
                <span
                  aria-hidden={!skipped}
                  className={cn(
                    "absolute inset-0 flex items-center gap-2 text-neutral-400 transition-opacity duration-300",
                    skipped ? "opacity-100 delay-200" : "opacity-0",
                  )}
                >
                  <span className="h-px flex-1 border-t border-dashed border-neutral-300" />
                  Skipped
                </span>
                {!skipped && (
                  <motion.span
                    layoutId={`suppression-${person.email}`}
                    transition={slide}
                    className="absolute inset-0 flex items-center gap-2"
                  >
                    <span className="min-w-0 truncate text-neutral-800">{person.email}</span>
                    <span className="ml-auto flex shrink-0 items-center gap-1.5 text-neutral-600">
                      <span className={cn("size-1.5 rounded-full", DOT[person.march])} aria-hidden />
                      {person.march}
                    </span>
                  </motion.span>
                )}
              </li>
            );
          })}
        </ul>

        <div
          className={cn(
            "mt-3 rounded-xl border px-3 pt-2.5 pb-1.5 transition-[background-color,border-color] duration-300",
            landed ? "border-neutral-200 bg-neutral-50" : "border-dashed border-neutral-300 bg-white",
          )}
        >
          <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-700">
            <svg viewBox="0 0 24 24" className="size-3.5 shrink-0" fill="none" aria-hidden>
              <path
                d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <motion.path
                d="m9 12 2 2 4-4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={false}
                animate={{ pathLength: landed ? 1 : 0, opacity: landed ? 1 : 0 }}
                transition={t(0.35, landed ? 0.3 : 0)}
              />
            </svg>
            Suppression list
            <span className="ml-auto text-neutral-500 tabular-nums">{suppressed.length}</span>
          </p>
          <ul aria-label="Suppression list" className="relative mt-1 h-14">
            {suppressed.map((person) => (
              <motion.li
                key={person.email}
                layoutId={`suppression-${person.email}`}
                transition={slide}
                className="flex h-7 items-center gap-2 text-xs"
              >
                <span className="min-w-0 truncate text-neutral-500 line-through decoration-neutral-300">
                  {person.email}
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-1.5 text-neutral-500">
                  <span className={cn("size-1.5 rounded-full", DOT[person.march])} aria-hidden />
                  {person.march}
                </span>
              </motion.li>
            ))}
            {!landed && (
              <li className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
                Nothing here yet.
              </li>
            )}
          </ul>
        </div>
      </LayoutGroup>

      <p className="mt-auto pb-1 text-xs text-neutral-500" aria-live="polite">
        {send === "march" ? "Two addresses failed on this send." : "Both were skipped automatically."}
      </p>
    </Visual>
  );
}

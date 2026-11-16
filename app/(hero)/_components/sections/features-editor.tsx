"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AtSign,
  Check,
  Columns2,
  Globe,
  Heading,
  Image as ImageIcon,
  MousePointerClick,
  PanelBottom,
  Pilcrow,
  RectangleHorizontal,
  Rss,
  Share2,
  Star,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

import { displayFont, focusRing } from "../landing-ui";
import { StatusPill, Visual, cardSurface, chipSurface, useMotion } from "./features-kit";

// The wide cell: a small block editor laid out on its canvas. Each tile in
// the palette puts its block into the email or takes it out again, and the
// email re-flows. Blocks always sit in the order a newsletter reads in, so
// whatever someone picks, the result still looks like an email.
//
// The sheet of paper has a fixed height that holds all eight blocks, so
// adding or removing one never changes the height of the page.

type BlockKey =
  | "logo"
  | "heading"
  | "image"
  | "paragraph"
  | "button"
  | "columns"
  | "social"
  | "footer";

const BLOCKS: { key: BlockKey; label: string; icon: LucideIcon }[] = [
  { key: "logo", label: "Logo", icon: Star },
  { key: "heading", label: "Heading", icon: Heading },
  { key: "image", label: "Image", icon: ImageIcon },
  { key: "paragraph", label: "Paragraph", icon: Pilcrow },
  { key: "button", label: "Button", icon: RectangleHorizontal },
  { key: "columns", label: "Columns", icon: Columns2 },
  { key: "social", label: "Social", icon: Share2 },
  { key: "footer", label: "Footer", icon: PanelBottom },
];

const STARTING_BLOCKS: BlockKey[] = ["logo", "heading", "image", "paragraph", "button"];

function BlockContent({ block }: { block: BlockKey }) {
  switch (block) {
    case "logo":
      return (
        <div className="flex items-center gap-1.5">
          <span className="size-4 rounded-[5px] bg-[#6C5ED1] shadow-[inset_0_-2px_3px_rgba(0,0,0,0.15)]" />
          <span className="text-[11.5px] font-semibold text-neutral-800">
            Northfield Arts Council
          </span>
        </div>
      );
    case "heading":
      return (
        <p
          className="text-[17px] leading-tight font-semibold tracking-tight text-neutral-950"
          style={displayFont}
        >
          Spring open studios
        </p>
      );
    case "image":
      // A stand-in picture: studio doorways and a sun, in the brand's violet.
      return (
        <svg
          viewBox="0 0 288 72"
          preserveAspectRatio="xMidYMid slice"
          className="block h-[72px] w-full rounded-md"
        >
          <rect width="288" height="72" fill="#f0eefb" />
          <circle cx="226" cy="24" r="13" fill="#6C5ED1" fillOpacity="0.9" />
          <path d="M0 72V54c38-12 78-12 118-2s92 8 170-8v28z" fill="#6C5ED1" fillOpacity="0.14" />
          <path d="M52 72V40a19 19 0 0 1 38 0v32z" fill="#6C5ED1" fillOpacity="0.5" />
          <path d="M100 72V48a14 14 0 0 1 28 0v24z" fill="#6C5ED1" fillOpacity="0.3" />
          <path d="M138 72V30a23 23 0 0 1 46 0v42z" fill="#6C5ED1" fillOpacity="0.72" />
          <path d="M153 72V44a8 8 0 0 1 16 0v28z" fill="#f0eefb" fillOpacity="0.9" />
        </svg>
      );
    case "paragraph":
      return (
        <p className="text-[11px] leading-[1.45] text-neutral-600">
          Forty artists open their doors on 18 and 19 April. Entry is free for members.
        </p>
      );
    case "button":
      return (
        <span className="inline-flex h-7 items-center rounded-md bg-neutral-950 px-3 text-[11px] font-medium text-white">
          See the programme
        </span>
      );
    case "columns":
      return (
        <div className="grid grid-cols-2 gap-1.5">
          {[
            ["Saturday", "Workshops from 10:00"],
            ["Sunday", "Family trail, all day"],
          ].map(([day, line]) => (
            <div key={day} className="rounded-md bg-neutral-100 px-2 py-1.5">
              <p className="text-[10.5px] font-medium text-neutral-800">{day}</p>
              <p className="truncate text-[10px] leading-snug text-neutral-500">{line}</p>
            </div>
          ))}
        </div>
      );
    case "social":
      return (
        <div className="flex gap-1.5">
          {[Globe, AtSign, Rss].map((Icon, i) => (
            <span
              key={i}
              className="flex size-5 items-center justify-center rounded-full bg-neutral-100 text-neutral-500"
            >
              <Icon className="size-3" />
            </span>
          ))}
        </div>
      );
    case "footer":
      return (
        <p className="truncate border-t border-neutral-200 pt-2 text-[10px] text-neutral-500">
          Northfield Arts Council · <span className="underline">Unsubscribe</span>
        </p>
      );
  }
}

export function EditorDemo() {
  const { t } = useMotion();
  const [active, setActive] = useState<BlockKey[]>(STARTING_BLOCKS);
  // The tile under the pointer or holding focus; its block is outlined in
  // the email the way the editor outlines a selected block.
  const [hot, setHot] = useState<BlockKey | null>(null);
  const [message, setMessage] = useState("");

  const toggle = (key: BlockKey, label: string) => {
    const adding = !active.includes(key);
    setActive((prev) => (adding ? [...prev, key] : prev.filter((k) => k !== key)));
    setMessage(`${label} ${adding ? "added to" : "removed from"} the email.`);
  };

  const shown = BLOCKS.filter((block) => active.includes(block.key));

  return (
    <Visual bleed={false} backdrop="dots" className="h-full" innerClassName="pb-6 sm:pb-8">
      {/* The editor's title bar, floating on the canvas. */}
      <div className={cn("flex h-10 items-center gap-2 rounded-xl px-3 text-[13px]", cardSurface)}>
        <span className="truncate font-medium text-neutral-900">April newsletter</span>
        <StatusPill>Draft</StatusPill>
        <span className="ml-auto shrink-0 text-xs text-neutral-500 tabular-nums">
          {shown.length} {shown.length === 1 ? "block" : "blocks"}
        </span>
      </div>

      <div className="mt-3 grid gap-3 @xl:grid-cols-[172px_minmax(0,1fr)] @xl:gap-5">
        {/* Palette */}
        <div className={cn("self-start rounded-xl p-2.5", cardSurface)}>
          <p id="features-editor-palette" className="px-0.5 text-[11px] font-medium text-neutral-500">
            Content blocks
          </p>
          <div
            role="group"
            aria-labelledby="features-editor-palette"
            className="mt-2 grid grid-cols-4 gap-1.5 @xl:grid-cols-2"
          >
            {BLOCKS.map(({ key, label, icon: Icon }) => {
              const on = active.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(key, label)}
                  onPointerEnter={() => setHot(key)}
                  onPointerLeave={() => setHot((current) => (current === key ? null : current))}
                  onFocus={() => setHot(key)}
                  onBlur={() => setHot((current) => (current === key ? null : current))}
                  className={cn(
                    "relative flex h-[52px] flex-col items-center justify-center gap-1.5 rounded-lg border text-[11px] leading-none",
                    "transition-[background-color,border-color,color,transform,box-shadow] duration-150 ease-out",
                    "active:scale-[0.96]",
                    on
                      ? "border-[#6C5ED1]/45 bg-[#6C5ED1]/[0.06] text-[#4f41b8]"
                      : "border-neutral-200 bg-white text-neutral-600 shadow-[0_1px_1px_rgba(0,0,0,0.03)] hover:border-neutral-300 hover:text-neutral-950",
                    focusRing,
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.75} aria-hidden />
                  {label}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-1 right-1 flex size-3 items-center justify-center rounded-full bg-[#6C5ED1] text-white transition-[opacity,transform] duration-150 ease-out",
                      on ? "scale-100 opacity-100" : "scale-50 opacity-0",
                    )}
                  >
                    <Check className="size-2" strokeWidth={3.5} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* The email, on a sheet of fixed height. */}
        <div
          className={cn(
            "mx-auto h-[376px] w-full max-w-[320px] overflow-hidden rounded-lg p-2",
            chipSurface,
            "shadow-[0_1px_1px_rgba(0,0,0,0.02),0_4px_8px_-2px_rgba(0,0,0,0.05),0_24px_40px_-20px_rgba(0,0,0,0.14)]",
          )}
          aria-hidden
        >
          <AnimatePresence initial={false}>
            {shown.map(({ key, label }) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={t(0.28)}
                className="overflow-hidden"
              >
                <div
                  className={cn(
                    "relative rounded-md px-2 py-1.5 transition-[box-shadow,background-color] duration-150",
                    hot === key && "bg-[#6C5ED1]/[0.05] shadow-[inset_0_0_0_1.5px_#6C5ED1]",
                  )}
                >
                  <BlockContent block={key} />
                  <span
                    className={cn(
                      "absolute top-0 right-0 rounded-tr-md rounded-bl-md bg-[#6C5ED1] px-1.5 text-[9px] leading-[14px] font-medium text-white transition-opacity duration-150",
                      hot === key ? "opacity-100" : "opacity-0",
                    )}
                  >
                    {label}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {shown.length === 0 && (
            <p className="px-2 py-12 text-center text-xs text-neutral-500">
              An empty email. Pick a block to start.
            </p>
          )}
        </div>
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-neutral-500 lg:hidden">
        <MousePointerClick className="size-3.5 shrink-0" aria-hidden />
        Pick a block to put it in the email or take it out.
      </p>
      <p className="sr-only" aria-live="polite">
        {message}
      </p>
    </Visual>
  );
}

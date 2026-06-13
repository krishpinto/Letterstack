"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { EmailBlock } from "@/lib/email/document";
import { CONTENT_BLOCKS, COLUMN_LAYOUTS } from "./editor-types";

export function BlockPalette({ onAdd }: { onAdd: (type: EmailBlock["type"]) => void }) {
  return (
    <div className="flex flex-col overflow-auto">
      {/* Header */}
      <div className="px-4 pb-2 pt-4">
        <p className="text-sm font-semibold">Content blocks</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Drag to add content to your email
        </p>
      </div>

      {/* 3-column grid — bordered card tiles */}
      <div className="grid grid-cols-3 gap-2 px-3 pb-3 pt-1">
        {CONTENT_BLOCKS.map(({ type, label, icon }) => (
          <button
            key={`${type}-${label}`}
            onClick={() => onAdd(type)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border border-border bg-background px-1 py-3",
              "text-[11px] leading-tight text-foreground/70",
              "transition-[border-color,background-color,transform] duration-150 ease-out",
              "hover:border-foreground/20 hover:bg-accent hover:text-foreground",
              "active:scale-[0.96]",
            )}
          >
            <HugeiconsIcon
              icon={icon}
              strokeWidth={1.5}
              className="size-6 text-foreground/50"
            />
            <span className="text-center">{label}</span>
          </button>
        ))}
      </div>

      <Separator />

      {/* Columns section */}
      <div className="px-4 pb-4 pt-3">
        <p className="text-sm font-semibold">Columns</p>
        <p className="mt-0.5 mb-3 text-xs text-muted-foreground">
          Drag to add a column container to your email
        </p>
        <div className="grid grid-cols-2 gap-2">
          {COLUMN_LAYOUTS.map((layout) => (
            <button
              key={layout.label}
              onClick={() => onAdd("columns")}
              className={cn(
                "flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5",
                "transition-[border-color,background-color,transform] duration-150 ease-out",
                "hover:border-foreground/20 hover:bg-accent",
                "active:scale-[0.97]",
              )}
            >
              <ColumnVisual widths={layout.widths} />
              <span className="text-xs font-medium">{layout.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ColumnVisual({ widths }: { widths: number[] }) {
  return (
    <div className="flex h-4 w-10 shrink-0 gap-0.5">
      {widths.map((w, i) => (
        <div
          key={i}
          className="h-full rounded-sm border border-foreground/20 bg-foreground/8"
          style={{ flex: w }}
        />
      ))}
    </div>
  );
}

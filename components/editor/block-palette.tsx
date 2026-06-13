"use client";

import * as React from "react";
import { useDraggable } from "@dnd-kit/core";
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
          Drag onto the canvas, or click to append
        </p>
      </div>

      {/* 3-column grid — bordered card tiles */}
      <div className="grid grid-cols-3 gap-2 px-3 pb-3 pt-1">
        {CONTENT_BLOCKS.map(({ type, label, icon }) => (
          <PaletteTile
            key={`${type}-${label}`}
            dragId={`palette:${type}:${label}`}
            blockType={type}
            onAdd={onAdd}
            className="flex flex-col items-center gap-2 px-1 py-3"
          >
            <HugeiconsIcon
              icon={icon}
              strokeWidth={1.5}
              className="size-6 text-foreground/50"
            />
            <span className="text-center text-[11px] leading-tight">{label}</span>
          </PaletteTile>
        ))}
      </div>

      <Separator />

      {/* Columns section */}
      <div className="px-4 pb-4 pt-3">
        <p className="text-sm font-semibold">Columns</p>
        <p className="mt-0.5 mb-3 text-xs text-muted-foreground">
          Drag a column container onto the canvas
        </p>
        <div className="grid grid-cols-2 gap-2">
          {COLUMN_LAYOUTS.map((layout) => (
            <PaletteTile
              key={layout.label}
              dragId={`palette:columns:${layout.label}`}
              blockType="columns"
              onAdd={onAdd}
              className="flex items-center gap-3 px-3 py-2.5"
            >
              <ColumnVisual widths={layout.widths} />
              <span className="text-xs font-medium">{layout.label}</span>
            </PaletteTile>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A palette tile that is both clickable (append) and draggable (drop at position). */
function PaletteTile({
  dragId,
  blockType,
  onAdd,
  className,
  children,
}: {
  dragId: string;
  blockType: EmailBlock["type"];
  onAdd: (type: EmailBlock["type"]) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId,
    data: { kind: "palette", blockType },
  });

  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onAdd(blockType)}
      className={cn(
        "rounded-lg border border-border bg-background text-foreground/70 touch-none",
        "transition-[border-color,background-color,transform,opacity] duration-150 ease-out",
        "hover:border-foreground/20 hover:bg-accent hover:text-foreground",
        "cursor-grab active:cursor-grabbing active:scale-[0.97]",
        isDragging && "opacity-40",
        className,
      )}
    >
      {children}
    </button>
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

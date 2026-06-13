"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Copy01Icon,
  Delete02Icon,
  DragDropVerticalIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { type EmailBlock, type TextAlign } from "@/lib/email/document";
import { BLOCK_LABELS } from "./editor-types";

/**
 * Canva-style floating action bar that hovers above the selected block.
 * Block-level operations only (reorder / align / duplicate / delete) — inline
 * text formatting lives in the TipTap BubbleMenu inside RichTextEditor.
 */
export function BlockBubbleMenu({
  block,
  canRemove,
  isDragging,
  dragHandleProps,
  onDuplicate,
  onRemove,
  onAlign,
}: {
  block: EmailBlock;
  canRemove: boolean;
  isDragging: boolean;
  /** Spread of dnd-kit `useSortable` attributes + listeners for the drag handle. */
  dragHandleProps: React.HTMLAttributes<HTMLButtonElement>;
  onDuplicate: () => void;
  onRemove: () => void;
  onAlign: (align: TextAlign) => void;
}) {
  const align = "align" in block ? block.align : undefined;

  return (
    <div
      className={cn(
        // Vertical strip pinned just outside the block's right edge, so it no
        // longer collides with the pinned text formatting toolbar up top.
        "absolute right-0 top-1 z-30 translate-x-[calc(100%+10px)]",
        "flex flex-col items-center gap-0.5 rounded-lg border bg-card p-1 shadow-lg",
        // Don't let the floating bar trigger the block's own click handlers
        "pointer-events-auto",
      )}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Drag handle — the primary dnd affordance */}
      <button
        {...dragHandleProps}
        type="button"
        title={`Drag to reorder ${BLOCK_LABELS[block.type]}`}
        aria-label="Drag to reorder block"
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded touch-none select-none",
          "text-muted-foreground transition-colors",
          "hover:bg-muted hover:text-foreground",
          isDragging ? "cursor-grabbing bg-primary/10 text-primary" : "cursor-grab",
        )}
      >
        <HugeiconsIcon icon={DragDropVerticalIcon} strokeWidth={2.5} className="size-4 opacity-70" />
      </button>

      {align !== undefined && (
        <>
          <Divider />
          <BubbleButton active={align === "left"} onClick={() => onAlign("left")} title="Align left">
            <AlignLeftIcon />
          </BubbleButton>
          <BubbleButton active={align === "center"} onClick={() => onAlign("center")} title="Align center">
            <AlignCenterIcon />
          </BubbleButton>
          <BubbleButton active={align === "right"} onClick={() => onAlign("right")} title="Align right">
            <AlignRightIcon />
          </BubbleButton>
        </>
      )}

      <Divider />

      <BubbleButton onClick={onDuplicate} title="Duplicate">
        <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} className="size-3.5" />
      </BubbleButton>

      <Divider />

      <BubbleButton
        onClick={onRemove}
        disabled={!canRemove}
        title="Delete"
        className="text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
      >
        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3.5" />
      </BubbleButton>
    </div>
  );
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function BubbleButton({
  active,
  disabled,
  onClick,
  className,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-7 min-w-7 items-center justify-center rounded px-1 text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground active:scale-[0.93]",
        active && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
        "disabled:pointer-events-none disabled:opacity-30",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="my-0.5 h-px w-4 shrink-0 bg-border" />;
}

// ─── Alignment icons ──────────────────────────────────────────────────────────

function AlignLeftIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor">
      <rect x="0" y="1.5" width="12" height="1.5" rx="0.5" />
      <rect x="0" y="5" width="7" height="1.5" rx="0.5" />
      <rect x="0" y="8.5" width="10" height="1.5" rx="0.5" />
    </svg>
  );
}

function AlignCenterIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor">
      <rect x="0" y="1.5" width="12" height="1.5" rx="0.5" />
      <rect x="2.5" y="5" width="7" height="1.5" rx="0.5" />
      <rect x="1" y="8.5" width="10" height="1.5" rx="0.5" />
    </svg>
  );
}

function AlignRightIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor">
      <rect x="0" y="1.5" width="12" height="1.5" rx="0.5" />
      <rect x="5" y="5" width="7" height="1.5" rx="0.5" />
      <rect x="2" y="8.5" width="10" height="1.5" rx="0.5" />
    </svg>
  );
}

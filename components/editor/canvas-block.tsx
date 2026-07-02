"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { HugeiconsIcon } from "@hugeicons/react";
import { DragDropVerticalIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import type { ColumnsBlock, EmailBlock } from "@/lib/email/document";
import { BLOCK_LABELS } from "./editor-types";
import { BlockBubbleMenu } from "./block-bubble-menu";
import { CanvasBlockPreview } from "./canvas-block-preview";
import { RichTextEditor } from "./rich-text-editor";
import { previewHtml } from "./preview-html";
import {
  CANVAS_ROOT_CONTAINER,
  useCanvas,
} from "./canvas-context";

/** Horizontal line showing where a dragged block will land. */
export function InsertIndicator() {
  return (
    <div className="relative h-0">
      <div className="pointer-events-none absolute inset-x-1 top-0 z-30 -translate-y-1/2">
        <div className="h-0.5 rounded-full bg-primary" />
        <div className="absolute left-0 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
      </div>
    </div>
  );
}

/**
 * A selectable + draggable block on the canvas. Works at the top level and
 * nested inside a column cell — `containerId` tells the dnd layer where it lives.
 */
export function CanvasBlock({
  block,
  total,
  containerId,
}: {
  block: EmailBlock;
  total: number;
  containerId: string;
}) {
  const ctx = useCanvas();
  const isSelected = ctx.selectedBlockId === block.id;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id, data: { kind: "block", containerId } });

  const isTopLevel = containerId === CANVAS_ROOT_CONTAINER;
  const canRemove = !isTopLevel || total > 1;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group/block relative",
        isSelected && "z-20",
        isDragging && "opacity-30",
      )}
    >
      {/* Hover / selection ring */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-30 rounded-none transition-[background-color,box-shadow] duration-150",
          isSelected
            ? "ls-selected-block-highlight bg-primary/5 shadow-[inset_0_0_0_2px_var(--primary)]"
            : "group-hover/block:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.14)]",
        )}
      />

      {/* Hover drag handle — un-selected blocks */}
      {!isSelected && (
        <div className="ls-hover-drag-handle absolute left-0 top-0 z-20 flex items-center opacity-0 transition-opacity duration-150 group-hover/block:opacity-100">
          <button
            {...attributes}
            {...listeners}
            className={cn(
              "flex items-center gap-1.5 px-2 py-[3px] touch-none select-none",
              "text-[9px] font-bold uppercase tracking-widest",
              "bg-foreground/70 text-background",
              isDragging ? "cursor-grabbing" : "cursor-grab",
            )}
            onClick={(e) => e.stopPropagation()}
            aria-label="Drag to reorder block"
          >
            {BLOCK_LABELS[block.type]}
            <HugeiconsIcon icon={DragDropVerticalIcon} strokeWidth={2.5} className="size-3 opacity-60" />
          </button>
        </div>
      )}

      {/* Canva-style bubble menu — selected only */}
      {isSelected && (
        <BlockBubbleMenu
          block={block}
          canRemove={canRemove}
          isDragging={isDragging}
          dragHandleProps={{ ...attributes, ...listeners }}
          onDuplicate={() => ctx.onDuplicate(block.id)}
          onRemove={() => ctx.onRemove(block.id)}
          onAlign={(align) =>
            ctx.onUpdateBlock(block.id, (b) => ({ ...b, align }) as EmailBlock)
          }
        />
      )}

      {/* Content */}
      <div
        className={cn(!isSelected && "cursor-pointer")}
        style={{
          backgroundColor: block.backgroundColor,
          paddingTop: block.paddingTop,
          paddingBottom: block.paddingBottom,
        }}
        onClick={(e) => {
          if (!isSelected) {
            e.stopPropagation();
            ctx.onSelect(block.id);
          }
        }}
      >
        {block.type === "columns" ? (
          <ColumnsCanvas block={block} />
        ) : (
          <CanvasBlockPreview
            block={block}
            document={ctx.document}
            isSelected={isSelected}
            onUpdateBlock={(updater) => ctx.onUpdateBlock(block.id, updater)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Columns ──────────────────────────────────────────────────────────────────

function ColumnsCanvas({ block }: { block: ColumnsBlock }) {
  const ctx = useCanvas();
  const p = ctx.document.settings.padding;
  const isSelected = ctx.selectedBlockId === block.id;

  return (
    <div style={{ padding: `4px ${p}px 24px` }}>
      <div
        className="grid items-stretch"
        style={{
          gridTemplateColumns: block.columns
            .map((column) => `${column.width || 1}fr`)
            .join(" "),
          gap: block.gap,
        }}
      >
        {block.columns.map((column) => (
          <ColumnPresetCell
            key={column.id}
            column={column}
            columnsBlock={block}
            editable={isSelected}
          />
        ))}
      </div>
    </div>
  );
}

function ColumnPresetCell({
  column,
  columnsBlock,
  editable,
}: {
  column: ColumnsBlock["columns"][number];
  columnsBlock: ColumnsBlock;
  editable: boolean;
}) {
  const ctx = useCanvas();
  const s = ctx.document.settings;

  const border =
    columnsBlock.borderStyle !== "none"
      ? `1px ${columnsBlock.borderStyle} ${columnsBlock.borderColor}`
      : undefined;
  const justify =
    columnsBlock.valign === "middle"
      ? "center"
      : columnsBlock.valign === "bottom"
      ? "flex-end"
      : "flex-start";
  const textColor = columnsBlock.textColor ?? s.textColor;

  const updateColumn = (patch: Partial<ColumnsBlock["columns"][number]>) => {
    ctx.onUpdateBlock(columnsBlock.id, (block) => {
      if (block.type !== "columns") return block;
      return {
        ...block,
        columns: block.columns.map((item) =>
          item.id === column.id ? { ...item, ...patch } : item,
        ),
      };
    });
  };

  const image =
    column.showImage ? (
      column.imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={column.imageSrc}
          alt={column.imageAlt}
          className="mb-3 aspect-[4/3] w-full rounded-md object-cover"
        />
      ) : (
        <div className="mb-3 flex aspect-[4/3] w-full items-center justify-center rounded-md bg-muted text-sm font-semibold text-muted-foreground">
          Image
        </div>
      )
    ) : null;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col transition-colors",
        editable && "outline outline-1 outline-dashed outline-transparent focus-within:outline-primary/35",
      )}
      style={{
        padding: columnsBlock.cellPadding,
        border,
        borderRadius: columnsBlock.borderRadius,
        backgroundColor: columnsBlock.columnBackgroundColor,
        justifyContent: justify,
        fontFamily: s.fontFamily,
      }}
    >
      {image}
      {column.eyebrow ? (
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: s.accentColor }}>
          {column.eyebrow}
        </p>
      ) : null}
      {editable ? (
        <RichTextEditor
          value={column.heading}
          onChange={(heading) => updateColumn({ heading })}
          editable
          defaultTextType="h3"
          defaultFontSize="18px"
          style={{
            color: textColor,
            fontSize: 18,
            fontWeight: 800,
            lineHeight: 1.25,
            marginBottom: 8,
          }}
        />
      ) : (
        <h3
          className="mb-2 text-lg font-extrabold leading-tight"
          style={{ color: textColor }}
          dangerouslySetInnerHTML={previewHtml(stripOuterP(column.heading))}
        />
      )}
      {editable ? (
        <RichTextEditor
          value={column.body}
          onChange={(body) => updateColumn({ body })}
          editable
          defaultTextType="p"
          defaultFontSize="14px"
          style={{
            color: textColor,
            fontSize: 14,
            lineHeight: 1.55,
            marginBottom: column.showCta ? 12 : 0,
            opacity: 0.82,
          }}
        />
      ) : (
        <div
          className={cn("text-sm leading-relaxed", column.showCta && "mb-3")}
          style={{ color: textColor, opacity: 0.82 }}
          dangerouslySetInnerHTML={previewHtml(column.body)}
        />
      )}
      {column.showCta ? (
        <span className="text-xs font-bold" style={{ color: s.linkColor }}>
          {column.linkLabel || "Learn more"} →
        </span>
      ) : null}
    </div>
  );
}

function stripOuterP(html: string): string {
  const stripped = html.replace(/^<p[^>]*>([\s\S]*?)<\/p>\s*$/i, "$1").trim();
  return stripped || html;
}

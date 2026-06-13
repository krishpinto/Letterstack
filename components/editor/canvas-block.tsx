"use client";

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, DragDropVerticalIcon } from "@hugeicons/core-free-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ColumnsBlock, EmailBlock } from "@/lib/email/document";
import { BLOCK_LABELS, CONTENT_BLOCKS } from "./editor-types";
import { BlockBubbleMenu } from "./block-bubble-menu";
import { CanvasBlockPreview } from "./canvas-block-preview";
import { ColumnResizer } from "./column-resizer";
import {
  CANVAS_ROOT_CONTAINER,
  isInsertHere,
  useCanvas,
} from "./canvas-context";

// Disable dnd-kit sibling shifting; the insertion line is the drop cue.
const noShift = () => null;

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
  index,
  total,
  containerId,
  onMove,
}: {
  block: EmailBlock;
  index: number;
  total: number;
  containerId: string;
  onMove: (from: number, to: number) => void;
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
      className={cn("group/block relative", isDragging && "opacity-30")}
    >
      {/* Hover / selection ring */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-10",
          isSelected
            ? "shadow-[inset_0_0_0_2px_hsl(var(--primary))]"
            : "group-hover/block:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]",
        )}
      />

      {/* Hover drag handle — un-selected blocks */}
      {!isSelected && (
        <div className="absolute left-0 top-0 z-20 flex items-center opacity-0 transition-opacity duration-150 group-hover/block:opacity-100">
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
          isFirst={index === 0}
          isLast={index === total - 1}
          canRemove={canRemove}
          isDragging={isDragging}
          dragHandleProps={{ ...attributes, ...listeners }}
          onMoveUp={() => { if (index > 0) onMove(index, index - 1); }}
          onMoveDown={() => { if (index < total - 1) onMove(index, index + 1); }}
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

  return (
    <div style={{ padding: `4px ${p}px 24px` }}>
      <div className="flex items-stretch">
        {block.columns.map((column, ci) => (
          <React.Fragment key={column.id}>
            <ColumnCell column={column} columnsBlock={block} />
            {ci < block.columns.length - 1 && (
              <ColumnResizer columnsBlock={block} leftIndex={ci} gap={block.gap} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function ColumnCell({
  column,
  columnsBlock,
}: {
  column: ColumnsBlock["columns"][number];
  columnsBlock: ColumnsBlock;
}) {
  const ctx = useCanvas();
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { kind: "cell", columnId: column.id },
  });

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

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-w-0 flex-col transition-colors",
        isOver && "bg-primary/5",
      )}
      style={{
        flexGrow: column.width,
        flexBasis: 0,
        padding: columnsBlock.cellPadding,
        border,
        borderRadius: columnsBlock.borderRadius,
        backgroundColor: columnsBlock.columnBackgroundColor,
        justifyContent: justify,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <SortableContext items={column.blocks.map((b) => b.id)} strategy={noShift}>
        {column.blocks.map((b, i) => (
          <div key={b.id}>
            {isInsertHere(ctx.insertTarget, column.id, i) && <InsertIndicator />}
            <CanvasBlock
              block={b}
              index={i}
              total={column.blocks.length}
              containerId={column.id}
              onMove={(from, to) => ctx.onReorderColumn(column.id, from, to)}
            />
          </div>
        ))}
        {isInsertHere(ctx.insertTarget, column.id, column.blocks.length) && <InsertIndicator />}
      </SortableContext>

      <AddBlockZone
        columnId={column.id}
        index={column.blocks.length}
        empty={column.blocks.length === 0}
        highlighted={isOver}
      />
    </div>
  );
}

function AddBlockZone({
  columnId,
  index,
  empty,
  highlighted,
}: {
  columnId: string;
  index: number;
  empty: boolean;
  highlighted: boolean;
}) {
  const addable = CONTENT_BLOCKS.filter((b) => b.type !== "columns");

  if (empty) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "flex min-h-[88px] w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed text-center transition-colors",
              highlighted
                ? "border-primary bg-primary/5 text-primary"
                : "border-muted-foreground/30 text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            <span className="flex items-center gap-1 text-xs font-medium">
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-3.5" />
              Add block
            </span>
            <span className="text-[10px] opacity-70">or drop content here</span>
          </button>
        </DropdownMenuTrigger>
        <AddBlockMenu columnId={columnId} index={index} addable={addable} />
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="mt-1 flex w-full items-center justify-center gap-1 rounded border border-transparent py-1 text-[10px] font-medium text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover/block:opacity-100"
        >
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-3" />
          Add block
        </button>
      </DropdownMenuTrigger>
      <AddBlockMenu columnId={columnId} index={index} addable={addable} />
    </DropdownMenu>
  );
}

function AddBlockMenu({
  columnId,
  index,
  addable,
}: {
  columnId: string;
  index: number;
  addable: typeof CONTENT_BLOCKS;
}) {
  const ctx = useCanvas();
  return (
    <DropdownMenuContent align="center" className="max-h-72 w-44 overflow-auto">
      {addable.map(({ type, label, icon }) => (
        <DropdownMenuItem
          key={`${type}-${label}`}
          onSelect={() => ctx.onAddToColumn(columnId, index, type)}
        >
          <HugeiconsIcon icon={icon} strokeWidth={1.5} className="size-4 text-muted-foreground" />
          {label}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  );
}

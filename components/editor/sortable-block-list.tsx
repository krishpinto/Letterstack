"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { HugeiconsIcon } from "@hugeicons/react";
import { DragDropVerticalIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { updateBlock, type EmailBlock, type EmailDocument } from "@/lib/email/document";
import { BLOCK_LABELS } from "./editor-types";
import { BlockBubbleMenu } from "./block-bubble-menu";
import { CanvasBlockPreview } from "./canvas-block-preview";

export function SortableBlockList({
  document,
  selectedBlockId,
  onSelectBlock,
  onReorder,
  onUpdateDocument,
  onDuplicate,
  onRemove,
}: {
  document: EmailDocument;
  selectedBlockId: string;
  onSelectBlock: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onUpdateDocument: (updater: (current: EmailDocument) => EmailDocument) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = document.blocks.findIndex((b) => b.id === active.id);
    const toIndex = document.blocks.findIndex((b) => b.id === over.id);
    if (fromIndex >= 0 && toIndex >= 0) onReorder(fromIndex, toIndex);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={document.blocks.map((b) => b.id)}
        strategy={verticalListSortingStrategy}
      >
        {document.blocks.map((block, index) => (
          <SortableBlock
            key={block.id}
            block={block}
            document={document}
            index={index}
            total={document.blocks.length}
            isSelected={selectedBlockId === block.id}
            onSelect={() => onSelectBlock(block.id)}
            onMoveUp={() => { if (index > 0) onReorder(index, index - 1); }}
            onMoveDown={() => {
              if (index < document.blocks.length - 1) onReorder(index, index + 1);
            }}
            onDuplicate={() => onDuplicate(block.id)}
            onRemove={() => onRemove(block.id)}
            onUpdateBlock={(updater) =>
              onUpdateDocument((current) => updateBlock(current, block.id, updater))
            }
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableBlock({
  block,
  document,
  index,
  total,
  isSelected,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onRemove,
  onUpdateBlock,
}: {
  block: EmailBlock;
  document: EmailDocument;
  index: number;
  total: number;
  isSelected: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onUpdateBlock: (updater: (b: EmailBlock) => EmailBlock) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group relative", isDragging && "opacity-50 z-50")}
    >
      {/* Hover / selection ring */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-10",
          isSelected
            ? "shadow-[inset_0_0_0_2px_hsl(var(--primary))]"
            : "group-hover:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]",
        )}
      />

      {/* Block type badge + drag handle */}
      <div
        className={cn(
          "absolute left-0 top-0 z-20 flex items-center opacity-0 transition-opacity duration-150",
          "group-hover:opacity-100",
          isSelected && "opacity-100",
        )}
      >
        <button
          {...attributes}
          {...listeners}
          className={cn(
            "flex cursor-grab items-center gap-1.5 px-2 py-[3px] touch-none select-none active:cursor-grabbing",
            "text-[9px] font-bold uppercase tracking-widest",
            isSelected
              ? "bg-primary text-primary-foreground"
              : "bg-foreground/70 text-background",
          )}
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag to reorder"
        >
          {BLOCK_LABELS[block.type]}
          <HugeiconsIcon icon={DragDropVerticalIcon} strokeWidth={2.5} className="size-3 opacity-60" />
        </button>
      </div>

      {/* Canva-style floating bubble menu — selected only */}
      {isSelected && (
        <BlockBubbleMenu
          block={block}
          isFirst={index === 0}
          isLast={index === total - 1}
          canRemove={total > 1}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
          onAlign={(align) =>
            onUpdateBlock((b) => ({ ...b, align }) as EmailBlock)
          }
        />
      )}

      {/* Block content */}
      <div
        className={cn(!isSelected && "cursor-pointer")}
        style={{
          backgroundColor: block.backgroundColor,
          paddingTop: block.paddingTop,
          paddingBottom: block.paddingBottom,
        }}
        onClick={() => { if (!isSelected) onSelect(); }}
      >
        <CanvasBlockPreview
          block={block}
          document={document}
          isSelected={isSelected}
          onUpdateBlock={onUpdateBlock}
        />
      </div>
    </div>
  );
}

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
import {
  Copy01Icon,
  Delete02Icon,
  DragDropVerticalIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { updateBlock, type EmailBlock, type EmailDocument } from "@/lib/email/document";
import { BLOCK_LABELS } from "./editor-types";
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
        {document.blocks.map((block) => (
          <SortableBlock
            key={block.id}
            block={block}
            document={document}
            isSelected={selectedBlockId === block.id}
            onSelect={() => onSelectBlock(block.id)}
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
  isSelected,
  onSelect,
  onDuplicate,
  onRemove,
  onUpdateBlock,
}: {
  block: EmailBlock;
  document: EmailDocument;
  isSelected: boolean;
  onSelect: () => void;
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

      {/* Right-side floating actions — selected only */}
      {isSelected && (
        <div
          className="absolute right-0 top-0 z-20 flex translate-x-[calc(100%+8px)] flex-col gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="flex h-8 w-8 items-center justify-center rounded border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground active:scale-[0.93]"
            onClick={onDuplicate}
            title="Duplicate"
          >
            <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} className="size-3.5" />
          </button>
          <button
            className="flex h-8 w-8 items-center justify-center rounded border border-border bg-card text-destructive/60 shadow-sm transition-colors hover:text-destructive active:scale-[0.93]"
            onClick={onRemove}
            title="Delete"
          >
            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3.5" />
          </button>
        </div>
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

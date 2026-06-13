"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type Active,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Over,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Analytics01Icon,
  ComputerIcon,
  Copy01Icon,
  GridViewIcon,
  LayersIcon,
  PaintBrush01Icon,
  SmartPhone01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { compileEmailDocument } from "@/lib/email/compiler";
import {
  createBlock,
  duplicateBlock,
  findBlock,
  initialEmailDocument,
  insertBlockAtIndex,
  insertIntoColumn,
  isEmailDocument,
  normalizeDocument,
  reorderBlocks,
  reorderInColumn,
  removeBlock,
  STORAGE_KEY,
  touchDocument,
  updateBlock,
  type EmailBlock,
  type EmailDocument,
} from "@/lib/email/document";

import { CanvasBlockPreview } from "./canvas-block-preview";
import {
  CANVAS_ROOT_CONTAINER,
  CanvasProvider,
  type CanvasContextValue,
  type InsertTarget,
} from "./canvas-context";
import { BLOCK_LABELS, CONTENT_BLOCKS, type ActivePanel } from "./editor-types";
import { EditorToolbarProvider, useEditorToolbar } from "./editor-toolbar-context";
import { FormattingToolbar } from "./formatting-toolbar";
import { GlobalSettingsSheet } from "./settings-sheet";
import { NavButton } from "./nav-button";
import { PreviewDialog } from "./preview-dialog";
import { SidePanel } from "./side-panel";
import { SortableBlockList } from "./sortable-block-list";

type ActiveDrag =
  | { kind: "palette"; blockType: EmailBlock["type"] }
  | { kind: "block"; block: EmailBlock; width: number };

export function LetterStackEditor() {
  const [document, setDocument] = React.useState<EmailDocument>(initialEmailDocument);
  const [isHydrated, setIsHydrated] = React.useState(false);
  const [selectedBlockId, setSelectedBlockId] = React.useState(
    initialEmailDocument.blocks[0]?.id ?? "",
  );
  const [activePanel, setActivePanel] = React.useState<ActivePanel>("blocks");
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "saved">("idle");
  const [copied, setCopied] = React.useState(false);

  // Drag-and-drop state (palette → canvas/cells + block reordering/moving)
  const [activeDrag, setActiveDrag] = React.useState<ActiveDrag | null>(null);
  const [insertTarget, setInsertTarget] = React.useState<InsertTarget | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const compiled = React.useMemo(() => compileEmailDocument(document), [document]);
  const selectedBlock = findBlock(document.blocks, selectedBlockId);
  const selectedIndex = document.blocks.findIndex((b) => b.id === selectedBlockId);

  // When a block is selected and the panel is closed, open it to blocks/inspector
  React.useEffect(() => {
    if (selectedBlockId) {
      setActivePanel((prev) => (prev === null ? "blocks" : prev));
    }
  }, [selectedBlockId]);

  // Hydrate from localStorage
  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (isEmailDocument(parsed)) {
            const migrated = normalizeDocument(parsed);
            setDocument(migrated);
            setSelectedBlockId(migrated.blocks[0]?.id ?? "");
          }
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
      setIsHydrated(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  // Autosave with 800ms debounce
  React.useEffect(() => {
    if (!isHydrated) return;
    const timeout = window.setTimeout(() => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
      setSaveStatus("saved");
      window.setTimeout(() => setSaveStatus("idle"), 1400);
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [document, isHydrated]);

  const updateDocument = React.useCallback(
    (updater: (current: EmailDocument) => EmailDocument) => {
      setDocument((current) => updater(current));
    },
    [],
  );

  const handleAddBlock = (type: EmailBlock["type"]) => {
    const block = createBlock(type);
    updateDocument((current) =>
      touchDocument({ ...current, blocks: [...current.blocks, block] }),
    );
    setSelectedBlockId(block.id);
    setActivePanel("blocks");
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    updateDocument((current) => reorderBlocks(current, fromIndex, toIndex));
  };

  // ── Canvas callbacks (shared with nested column blocks via context) ──────────

  const handleSelect = (id: string) => {
    setSelectedBlockId(id);
    setActivePanel("blocks");
  };

  const handleReorderColumn = (columnId: string, from: number, to: number) => {
    updateDocument((current) => reorderInColumn(current, columnId, from, to));
  };

  const handleAddToColumn = (columnId: string, index: number, type: EmailBlock["type"]) => {
    if (type === "columns") return; // no nesting columns inside columns
    const block = createBlock(type);
    updateDocument((current) => insertIntoColumn(current, columnId, index, block));
    setSelectedBlockId(block.id);
    setActivePanel("blocks");
  };

  const canvasValue: CanvasContextValue = {
    document,
    selectedBlockId,
    insertTarget,
    onSelect: handleSelect,
    onUpdateBlock: (id, updater) => updateDocument((c) => updateBlock(c, id, updater)),
    onDuplicate: (id) => updateDocument((c) => duplicateBlock(c, id)),
    onRemove: (id) => {
      updateDocument((c) => removeBlock(c, id));
      if (selectedBlockId === id) setSelectedBlockId("");
    },
    onReorderTop: handleReorder,
    onReorderColumn: handleReorderColumn,
    onAddToColumn: handleAddToColumn,
  };

  // ── Drag-and-drop ──────────────────────────────────────────────────────────

  type DragData = {
    kind?: "palette" | "block" | "cell";
    blockType?: EmailBlock["type"];
    columnId?: string;
    containerId?: string;
  };

  const columnBlocks = (containerId: string): EmailBlock[] => {
    if (containerId === CANVAS_ROOT_CONTAINER) return document.blocks;
    for (const block of document.blocks) {
      if (block.type === "columns") {
        const col = block.columns.find((c) => c.id === containerId);
        if (col) return col.blocks;
      }
    }
    return [];
  };

  // Prefer the most specific droppable under the pointer (block/cell over root).
  const collisionDetection: CollisionDetection = (args) => {
    const pointerHits = pointerWithin(args);
    const hits = pointerHits.length ? pointerHits : rectIntersection(args);
    const specific = hits.find((h) => h.id !== CANVAS_ROOT_CONTAINER);
    return specific ? [specific] : hits;
  };

  const resolveTarget = (active: Active, over: Over): InsertTarget | null => {
    const overData = (over.data.current ?? {}) as DragData;

    if (overData.kind === "cell" && overData.columnId) {
      return { containerId: overData.columnId, index: columnBlocks(overData.columnId).length };
    }
    if (over.id === CANVAS_ROOT_CONTAINER) {
      return { containerId: CANVAS_ROOT_CONTAINER, index: document.blocks.length };
    }
    if (overData.kind === "block" && overData.containerId) {
      const list = columnBlocks(overData.containerId);
      const idx = list.findIndex((b) => b.id === over.id);
      if (idx < 0) return null;
      const activeRect = active.rect.current.translated;
      const activeCenterY = activeRect ? activeRect.top + activeRect.height / 2 : 0;
      const overCenterY = over.rect.top + over.rect.height / 2;
      const before = activeCenterY < overCenterY;
      return { containerId: overData.containerId, index: before ? idx : idx + 1 };
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const data = (event.active.data.current ?? {}) as DragData;
    if (data.kind === "palette" && data.blockType) {
      setActiveDrag({ kind: "palette", blockType: data.blockType });
      return;
    }
    const block = findBlock(document.blocks, String(event.active.id));
    if (block) {
      setActiveDrag({
        kind: "block",
        block,
        width: event.active.rect.current.initial?.width ?? document.settings.maxWidth,
      });
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    setInsertTarget(over ? resolveTarget(active, over) : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const data = (active.data.current ?? {}) as DragData;
    const target = over ? resolveTarget(active, over) : null;

    if (data.kind === "palette" && data.blockType && target) {
      // Columns can only live at the top level.
      if (!(data.blockType === "columns" && target.containerId !== CANVAS_ROOT_CONTAINER)) {
        const block = createBlock(data.blockType);
        updateDocument((c) =>
          target.containerId === CANVAS_ROOT_CONTAINER
            ? insertBlockAtIndex(c, target.index, block)
            : insertIntoColumn(c, target.containerId, target.index, block),
        );
        setSelectedBlockId(block.id);
        setActivePanel("blocks");
      }
    } else if (data.kind === "block" && target) {
      moveBlockTo(String(active.id), data.containerId ?? CANVAS_ROOT_CONTAINER, target);
    }

    setActiveDrag(null);
    setInsertTarget(null);
  };

  const moveBlockTo = (blockId: string, sourceContainer: string, target: InsertTarget) => {
    const moving = findBlock(document.blocks, blockId);
    if (!moving) return;
    // Disallow moving a columns block into a cell, or a block into itself.
    if (moving.type === "columns" && target.containerId !== CANVAS_ROOT_CONTAINER) return;

    const sourceList = columnBlocks(sourceContainer);
    const sourceIndex = sourceList.findIndex((b) => b.id === blockId);
    let insertIndex = target.index;
    if (sourceContainer === target.containerId && sourceIndex >= 0 && sourceIndex < insertIndex) {
      insertIndex -= 1; // account for the gap left after removal
    }
    if (sourceContainer === target.containerId && sourceIndex === insertIndex) return; // no-op

    updateDocument((c) => {
      const detached = removeBlock(c, blockId);
      return target.containerId === CANVAS_ROOT_CONTAINER
        ? insertBlockAtIndex(detached, insertIndex, moving)
        : insertIntoColumn(detached, target.containerId, insertIndex, moving);
    });
  };

  const handleDragCancel = () => {
    setActiveDrag(null);
    setInsertTarget(null);
  };

  const togglePanel = (panel: ActivePanel) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  const copyHtml = async () => {
    await navigator.clipboard.writeText(compiled.html);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <EditorToolbarProvider>
    <main className="relative flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <header className="grid h-[52px] shrink-0 grid-cols-3 items-center border-b bg-card px-4">
        <div className="flex items-center gap-3">
          <span className="select-none text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            LetterStack
          </span>
          <div className="h-4 w-px bg-border" />
          <span className="max-w-48 truncate text-sm font-semibold">{document.name}</span>
          {saveStatus === "saved" && (
            <span className="text-xs text-muted-foreground">Saved</span>
          )}
        </div>

        <div className="flex justify-center gap-1">
          <ToggleGroup type="single" defaultValue="desktop" variant="outline" size="sm">
            <ToggleGroupItem value="desktop">
              <HugeiconsIcon icon={ComputerIcon} strokeWidth={2} className="size-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="mobile">
              <HugeiconsIcon icon={SmartPhone01Icon} strokeWidth={2} className="size-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="flex items-center justify-end gap-2">
          <GlobalSettingsSheet document={document} onUpdateDocument={updateDocument} />
          <PreviewDialog compiled={compiled} />
          <Button variant="outline" size="sm" onClick={copyHtml}>
            <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} data-icon="inline-start" />
            {copied ? "Copied!" : "Copy HTML"}
          </Button>
          <Button variant="outline" size="sm">Send test</Button>
          <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700">
            Save and exit
          </Button>
        </div>
      </header>

      {/* ── Floating text formatting bubble (Canva-style) ─────────────────── */}
      <FormattingToolbarOverlay />

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
      <div className="flex min-h-0 flex-1">

        {/* Icon nav — 56px */}
        <nav className="z-20 flex w-14 shrink-0 flex-col items-center gap-0.5 border-r bg-card pb-3 pt-2">
          <NavButton
            icon={GridViewIcon}
            label="Blocks"
            active={activePanel === "blocks"}
            onClick={() => togglePanel("blocks")}
          />
          <NavButton
            icon={LayersIcon}
            label="Sections"
            active={activePanel === "sections"}
            onClick={() => togglePanel("sections")}
          />
          <NavButton
            icon={PaintBrush01Icon}
            label="Styles"
            active={activePanel === "styles"}
            onClick={() => togglePanel("styles")}
          />
          <NavButton
            icon={Analytics01Icon}
            label="Optimize"
            active={activePanel === "optimize"}
            onClick={() => togglePanel("optimize")}
          />
        </nav>

        {/* Flyout panel — 320px */}
        <SidePanel
          activePanel={activePanel}
          document={document}
          selectedBlock={selectedBlock}
          selectedIndex={selectedIndex}
          onAdd={handleAddBlock}
          onBack={() => setSelectedBlockId("")}
          onMoveUp={() => {
            if (selectedIndex > 0) handleReorder(selectedIndex, selectedIndex - 1);
          }}
          onMoveDown={() => {
            if (selectedIndex < document.blocks.length - 1)
              handleReorder(selectedIndex, selectedIndex + 1);
          }}
          onUpdateDocument={updateDocument}
        />

        {/* Canvas */}
        <div
          className="min-w-0 flex-1 overflow-auto bg-zinc-100"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedBlockId("");
          }}
        >
          <div className="flex min-h-full justify-center px-8 pr-20 pb-10 pt-16">
            <div
              className="relative w-full shadow-sm"
              style={{
                maxWidth: document.settings.maxWidth,
                borderRadius: document.settings.radius,
                backgroundColor: document.settings.contentColor,
              }}
            >
              <CanvasProvider value={canvasValue}>
                <SortableBlockList />
              </CanvasProvider>
            </div>
          </div>
        </div>
      </div>

        {/* Crisp moving copy — fixes the in-flow block distortion during drag */}
        <DragOverlay dropAnimation={null}>
          {activeDrag?.kind === "block" ? (
            <div
              className="cursor-grabbing overflow-hidden rounded-md shadow-2xl ring-2 ring-primary"
              style={{ width: activeDrag.width, backgroundColor: document.settings.contentColor }}
            >
              <CanvasBlockPreview block={activeDrag.block} document={document} />
            </div>
          ) : activeDrag?.kind === "palette" ? (
            <PaletteDragChip blockType={activeDrag.blockType} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </main>
    </EditorToolbarProvider>
  );
}

/**
 * Floating formatting bubble pinned to the top-center of the workspace. Only
 * mounts while a text block is selected — disappears entirely otherwise.
 */
function FormattingToolbarOverlay() {
  const { activeEditor } = useEditorToolbar();
  if (!activeEditor) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[60px] z-40 flex justify-center">
      <div className="pointer-events-auto flex max-w-[calc(100%-2rem)] items-center gap-0.5 overflow-x-auto rounded-xl border bg-card px-2 py-1.5 shadow-lg">
        <FormattingToolbar editor={activeEditor} />
      </div>
    </div>
  );
}

function PaletteDragChip({ blockType }: { blockType: EmailBlock["type"] }) {
  const entry = CONTENT_BLOCKS.find((b) => b.type === blockType);
  return (
    <div className="flex cursor-grabbing items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs font-medium shadow-xl">
      {entry && (
        <HugeiconsIcon icon={entry.icon} strokeWidth={1.5} className="size-4 text-foreground/60" />
      )}
      {BLOCK_LABELS[blockType]}
    </div>
  );
}

"use client";

import * as React from "react";
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
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowUp01Icon,
  CodeIcon,
  ComputerIcon,
  Copy01Icon,
  Cursor01Icon,
  Delete02Icon,
  DragDropVerticalIcon,
  ExpandParagraphIcon,
  EyeIcon,
  Image01Icon,
  LayoutTwoColumnIcon,
  News01Icon,
  Settings02Icon,
  SmartPhone01Icon,
  TextAlignJustifyCenterIcon,
  TextIcon,
} from "@hugeicons/core-free-icons";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { compileEmailDocument } from "@/lib/email/compiler";
import { RichTextEditor } from "./rich-text-editor";
import {
  createBlock,
  duplicateBlock,
  initialEmailDocument,
  isEmailDocument,
  reorderBlocks,
  removeBlock,
  STORAGE_KEY,
  touchDocument,
  updateBlock,
  type ArticleCardBlock,
  type ButtonBlock,
  type ColumnsBlock,
  type EmailBlock,
  type EmailDocument,
  type EmailDocumentSettings,
  type ImageBlock,
  type RawHtmlBlock,
  type SpacerBlock,
  type TextAlign,
  type TextBlock,
} from "@/lib/email/document";

type PreviewMode = "desktop" | "mobile";

const FONT_FAMILIES = [
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', Tahoma, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Verdana, sans-serif" },
];

const BLOCK_LABELS: Record<EmailBlock["type"], string> = {
  text: "Text",
  image: "Image",
  button: "Button",
  divider: "Divider",
  spacer: "Spacer",
  columns: "Columns",
  articleCard: "Article Card",
  rawHtml: "Raw HTML",
};

const BLOCK_PALETTE: Array<{
  type: EmailBlock["type"];
  label: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
}> = [
  { type: "text", label: "Text", description: "Heading + body copy", icon: TextIcon },
  { type: "articleCard", label: "Article Card", description: "Image + headline + link", icon: News01Icon },
  { type: "image", label: "Image", description: "Full-width image", icon: Image01Icon },
  { type: "button", label: "Button", description: "Call to action", icon: Cursor01Icon },
  { type: "columns", label: "Columns", description: "Side-by-side content", icon: LayoutTwoColumnIcon },
  { type: "divider", label: "Divider", description: "Horizontal rule", icon: TextAlignJustifyCenterIcon },
  { type: "spacer", label: "Spacer", description: "Vertical gap", icon: ExpandParagraphIcon },
  { type: "rawHtml", label: "Raw HTML", description: "Custom HTML block", icon: CodeIcon },
];

// ─── Main editor ──────────────────────────────────────────────────────────────

export function LetterStackEditor() {
  const [document, setDocument] = React.useState<EmailDocument>(initialEmailDocument);
  const [isHydrated, setIsHydrated] = React.useState(false);
  const [selectedBlockId, setSelectedBlockId] = React.useState(
    initialEmailDocument.blocks[0]?.id ?? "",
  );
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "saved">("idle");
  const [copied, setCopied] = React.useState(false);

  const compiled = React.useMemo(() => compileEmailDocument(document), [document]);
  const selectedBlock = document.blocks.find((b) => b.id === selectedBlockId);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (isEmailDocument(parsed)) {
            setDocument(parsed);
            setSelectedBlockId(parsed.blocks[0]?.id ?? "");
          }
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
      setIsHydrated(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

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
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    updateDocument((current) => reorderBlocks(current, fromIndex, toIndex));
  };

  const copyHtml = async () => {
    await navigator.clipboard.writeText(compiled.html);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const selectedIndex = document.blocks.findIndex((b) => b.id === selectedBlockId);

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      {/* ── Top bar: 3-column ─────────────────────────────────────────────── */}
      <header className="grid h-[52px] shrink-0 grid-cols-3 items-center border-b bg-card px-4">
        {/* Left */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase select-none">
            LetterStack
          </span>
          <div className="h-4 w-px bg-border" />
          <span className="max-w-48 truncate text-sm font-semibold">{document.name}</span>
          {saveStatus === "saved" && (
            <span className="text-xs text-muted-foreground">Saved</span>
          )}
        </div>

        {/* Center — empty placeholder, will add desktop/mobile toggle to canvas later */}
        <div className="flex justify-center" />

        {/* Right */}
        <div className="flex items-center justify-end gap-2">
          <GlobalSettingsSheet document={document} onUpdateDocument={updateDocument} />
          <PreviewDialog compiled={compiled} />
          <Button variant="outline" size="sm" onClick={copyHtml}>
            <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} data-icon="inline-start" />
            {copied ? "Copied!" : "Copy HTML"}
          </Button>
          <Button size="sm">Save draft</Button>
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1">

        {/* Left sidebar — 320px */}
        <aside className="flex w-[320px] shrink-0 flex-col overflow-hidden border-r bg-card">
          {selectedBlock ? (
            <BlockInspector
              block={selectedBlock}
              document={document}
              onBack={() => setSelectedBlockId("")}
              onMoveUp={() => { if (selectedIndex > 0) handleReorder(selectedIndex, selectedIndex - 1); }}
              onMoveDown={() => { if (selectedIndex < document.blocks.length - 1) handleReorder(selectedIndex, selectedIndex + 1); }}
              onUpdateDocument={updateDocument}
            />
          ) : (
            <BlockPalette onAdd={handleAddBlock} />
          )}
        </aside>

        {/* Canvas — neutral gray, email centered */}
        <div
          className="min-w-0 flex-1 overflow-auto bg-zinc-100"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedBlockId(""); }}
        >
          {/* Extra right padding (pr-20) leaves room for the floating block actions */}
          <div className="flex min-h-full justify-center px-8 pr-20 py-10">
            <div
              className="relative w-full shadow-sm"
              style={{
                maxWidth: document.settings.maxWidth,
                borderRadius: document.settings.radius,
                backgroundColor: document.settings.contentColor,
              }}
            >
              <SortableBlockList
                document={document}
                selectedBlockId={selectedBlockId}
                onSelectBlock={setSelectedBlockId}
                onReorder={handleReorder}
                onUpdateDocument={updateDocument}
                onDuplicate={(id) => updateDocument((c) => duplicateBlock(c, id))}
                onRemove={(id) => {
                  const idx = document.blocks.findIndex((b) => b.id === id);
                  updateDocument((c) => removeBlock(c, id));
                  const next = document.blocks[idx + 1] ?? document.blocks[idx - 1];
                  setSelectedBlockId(next?.id ?? "");
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── Block palette ────────────────────────────────────────────────────────────

function BlockPalette({ onAdd }: { onAdd: (type: EmailBlock["type"]) => void }) {
  return (
    <div className="flex flex-col overflow-auto p-3">
      <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Content blocks
      </p>
      <div className="flex flex-col gap-0.5">
        {BLOCK_PALETTE.map(({ type, label, description, icon }) => (
          <button
            key={type}
            onClick={() => onAdd(type)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <HugeiconsIcon icon={icon} strokeWidth={1.75} className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-none">{label}</p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Sortable block list ──────────────────────────────────────────────────────

function SortableBlockList({
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
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={document.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative",
        isDragging && "opacity-50 z-50",
      )}
    >
      {/* Hover / selected ring overlay */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-10 transition-shadow",
          isSelected
            ? "ring-2 ring-inset ring-primary shadow-[inset_0_0_0_2px]"
            : "group-hover:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.15)]",
        )}
      />

      {/* Badge + drag handle — visible on hover/selected */}
      <div
        className={cn(
          "absolute left-0 top-0 z-20 flex items-center gap-0 opacity-0 transition-opacity",
          "group-hover:opacity-100",
          isSelected && "opacity-100",
        )}
      >
        <button
          {...attributes}
          {...listeners}
          className={cn(
            "flex cursor-grab items-center gap-1.5 px-2 py-[3px] text-[9px] font-bold uppercase tracking-widest touch-none select-none active:cursor-grabbing",
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

      {/* Right-side floating actions — only when selected */}
      {isSelected && (
        <div
          className="absolute right-0 top-0 z-20 flex translate-x-[calc(100%+8px)] flex-col gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="flex h-8 w-8 items-center justify-center rounded border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
            onClick={onDuplicate}
            title="Duplicate"
          >
            <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} className="size-3.5" />
          </button>
          <button
            className="flex h-8 w-8 items-center justify-center rounded border border-border bg-card text-destructive/60 shadow-sm transition-colors hover:text-destructive"
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

// ─── Canvas block previews ────────────────────────────────────────────────────

function stripOuterP(html: string): string {
  const stripped = html.replace(/^<p[^>]*>([\s\S]*?)<\/p>\s*$/i, "$1").trim();
  return stripped || html;
}

function CanvasBlockPreview({
  block,
  document,
  isSelected,
  onUpdateBlock,
}: {
  block: EmailBlock;
  document: EmailDocument;
  isSelected?: boolean;
  onUpdateBlock?: (updater: (b: EmailBlock) => EmailBlock) => void;
}) {
  const s = document.settings;
  const textColor = block.textColor ?? s.textColor;
  const editable = isSelected && !!onUpdateBlock;

  switch (block.type) {
    case "image":
      return (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.src}
            alt={block.alt}
            style={{ display: "block", width: `${block.width}%`, maxWidth: "100%", height: "auto", margin: "0 auto" }}
          />
        </div>
      );

    case "text":
      return (
        <div style={{ padding: `28px ${s.padding}px 18px`, textAlign: block.align, fontFamily: s.fontFamily }}>
          {(block.eyebrow || editable) && (
            editable ? (
              <textarea
                value={block.eyebrow ?? ""}
                rows={1}
                onChange={(e) => onUpdateBlock!((b) => ({ ...b, eyebrow: e.target.value }) as TextBlock)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Eyebrow label…"
                className="mb-2 block w-full resize-none overflow-hidden bg-transparent text-[11px] font-bold uppercase tracking-wider outline-none placeholder:opacity-30 border-b border-dashed border-current/20 focus:border-current/40"
                style={{ color: s.accentColor }}
              />
            ) : (
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: s.accentColor }}>
                {block.eyebrow}
              </p>
            )
          )}
          {editable ? (
            <RichTextEditor
              value={block.heading}
              onChange={(html) => onUpdateBlock!((b) => ({ ...b, heading: html }) as TextBlock)}
              editable
              style={{ color: textColor, fontSize: 26, fontWeight: 800, lineHeight: 1.14, marginBottom: 12 }}
            />
          ) : (
            <h2
              className="mb-3 text-[26px] font-extrabold leading-tight"
              style={{ color: textColor }}
              dangerouslySetInnerHTML={{ __html: stripOuterP(block.heading) }}
            />
          )}
          {editable ? (
            <RichTextEditor
              value={block.body}
              onChange={(html) => onUpdateBlock!((b) => ({ ...b, body: html }) as TextBlock)}
              editable
              style={{ color: textColor, fontSize: 14, lineHeight: 1.65 }}
            />
          ) : (
            <div
              className="text-sm leading-relaxed"
              style={{ color: textColor }}
              dangerouslySetInnerHTML={{ __html: block.body }}
            />
          )}
        </div>
      );

    case "articleCard":
      return (
        <div style={{ padding: `16px ${s.padding}px`, fontFamily: s.fontFamily }}>
          <div className={cn("flex gap-4", block.imagePosition === "right" && "flex-row-reverse")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={block.imageSrc}
              alt={block.imageAlt}
              className="rounded object-cover"
              style={{ width: "40%", height: "auto", flexShrink: 0 }}
            />
            <div className="flex min-w-0 flex-col justify-start">
              {editable ? (
                <RichTextEditor
                  value={block.headline}
                  onChange={(html) => onUpdateBlock!((b) => ({ ...b, headline: html }) as ArticleCardBlock)}
                  editable
                  style={{ color: textColor, fontSize: 14, fontWeight: 800, lineHeight: 1.3, marginBottom: 8 }}
                />
              ) : (
                <h3
                  className="mb-2 text-sm font-extrabold leading-snug"
                  style={{ color: textColor }}
                  dangerouslySetInnerHTML={{ __html: stripOuterP(block.headline) }}
                />
              )}
              {editable ? (
                <RichTextEditor
                  value={block.body}
                  onChange={(html) => onUpdateBlock!((b) => ({ ...b, body: html }) as ArticleCardBlock)}
                  editable
                  style={{ color: textColor, fontSize: 12, lineHeight: 1.6, opacity: 0.8, marginBottom: 12 }}
                />
              ) : (
                <div
                  className="mb-3 text-xs leading-relaxed"
                  style={{ color: textColor, opacity: 0.8 }}
                  dangerouslySetInnerHTML={{ __html: block.body }}
                />
              )}
              {block.linkUrl && (
                <span className="text-xs font-bold" style={{ color: s.accentColor }}>
                  {block.linkLabel || "Read more"} →
                </span>
              )}
            </div>
          </div>
        </div>
      );

    case "columns":
      return (
        <div style={{ padding: `4px ${s.padding}px 24px` }}>
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${block.columns.length}, 1fr)` }}>
            {block.columns.map((column) => (
              <div key={column.id} className="rounded-md border p-3">
                {editable ? (
                  <RichTextEditor
                    value={column.heading}
                    onChange={(html) =>
                      onUpdateBlock!((b) => ({
                        ...b,
                        columns: (b as ColumnsBlock).columns.map((c) =>
                          c.id === column.id ? { ...c, heading: html } : c,
                        ),
                      }) as ColumnsBlock)
                    }
                    editable
                    style={{ color: textColor, fontSize: 14, fontWeight: 800, lineHeight: 1.3, marginBottom: 6 }}
                  />
                ) : (
                  <h4
                    className="mb-1.5 text-sm font-extrabold leading-tight"
                    style={{ color: textColor }}
                    dangerouslySetInnerHTML={{ __html: stripOuterP(column.heading) }}
                  />
                )}
                {editable ? (
                  <RichTextEditor
                    value={column.body}
                    onChange={(html) =>
                      onUpdateBlock!((b) => ({
                        ...b,
                        columns: (b as ColumnsBlock).columns.map((c) =>
                          c.id === column.id ? { ...c, body: html } : c,
                        ),
                      }) as ColumnsBlock)
                    }
                    editable
                    style={{ color: textColor, fontSize: 12, lineHeight: 1.55, opacity: 0.8 }}
                  />
                ) : (
                  <div
                    className="text-xs leading-relaxed"
                    style={{ color: textColor, opacity: 0.8 }}
                    dangerouslySetInnerHTML={{ __html: column.body }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      );

    case "button":
      return (
        <div style={{ padding: `4px ${s.padding}px 28px`, textAlign: block.align, fontFamily: s.fontFamily }}>
          <span
            className="inline-block text-white"
            style={{
              backgroundColor: s.accentColor,
              borderRadius: s.buttonRadius,
              fontSize: s.buttonFontSize,
              fontWeight: 700,
              lineHeight: 1,
              padding: `${s.buttonPaddingY}px ${s.buttonPaddingX}px`,
            }}
          >
            {block.label}
          </span>
        </div>
      );

    case "divider":
      return (
        <div style={{ padding: `8px ${s.padding}px 28px` }}>
          <div className="h-px bg-foreground/10" />
        </div>
      );

    case "spacer":
      return <div style={{ height: block.height }} />;

    case "rawHtml":
      return (
        <div className="px-4 py-3 text-xs text-muted-foreground">
          {block.label || "Raw HTML block"}
        </div>
      );
  }
}

// ─── Block inspector ──────────────────────────────────────────────────────────

function BlockInspector({
  block,
  document,
  onBack,
  onMoveUp,
  onMoveDown,
  onUpdateDocument,
}: {
  block: EmailBlock;
  document: EmailDocument;
  onBack: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdateDocument: (updater: (current: EmailDocument) => EmailDocument) => void;
}) {
  const setBlock = (updater: (block: EmailBlock) => EmailBlock) => {
    onUpdateDocument((current) => updateBlock(current, block.id, updater));
  };

  return (
    <>
      {/* Inspector header */}
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-3.5" />
          Blocks
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={onMoveUp}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Move up"
          >
            <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={2} className="size-3.5" />
          </button>
          <button
            onClick={onMoveDown}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Move down"
          >
            <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} className="size-3.5" />
          </button>
          <Badge variant="secondary" className="text-[10px]">
            {BLOCK_LABELS[block.type]}
          </Badge>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-4">
          <FieldGroup>
            {block.type === "text" && <TextBlockFields block={block} onChange={setBlock} />}
            {block.type === "image" && <ImageBlockFields block={block} onChange={setBlock} />}
            {block.type === "button" && <ButtonBlockFields block={block} onChange={setBlock} />}
            {block.type === "columns" && <ColumnsBlockFields block={block} onChange={setBlock} />}
            {block.type === "articleCard" && <ArticleCardBlockFields block={block} onChange={setBlock} />}
            {block.type === "spacer" && <SpacerBlockFields block={block} onChange={setBlock} />}
            {block.type === "rawHtml" && <RawHtmlBlockFields block={block} onChange={setBlock} />}
            {block.type === "divider" && (
              <Field>
                <FieldTitle>Divider</FieldTitle>
                <FieldDescription>Renders as a 1px horizontal rule in the email.</FieldDescription>
              </Field>
            )}
          </FieldGroup>

          <Separator />

          <FieldGroup>
            <Field>
              <FieldTitle>Block styling</FieldTitle>
              <FieldDescription>Overrides for this block only.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Background</FieldLabel>
              <div className="flex items-center gap-2">
                <div className="grid flex-1 grid-cols-[32px_1fr] items-center gap-2">
                  <input
                    type="color"
                    value={block.backgroundColor ?? "#ffffff"}
                    onChange={(e) => setBlock((b) => ({ ...b, backgroundColor: e.target.value }))}
                    className="h-8 w-8 cursor-pointer rounded border p-0.5"
                  />
                  <Input
                    value={block.backgroundColor ?? ""}
                    placeholder="Transparent"
                    onChange={(e) => setBlock((b) => ({ ...b, backgroundColor: e.target.value || undefined }))}
                    className="h-8 font-mono text-xs"
                  />
                </div>
                {block.backgroundColor && (
                  <Button variant="ghost" size="sm" className="shrink-0 text-xs"
                    onClick={() => setBlock((b) => ({ ...b, backgroundColor: undefined }))}>
                    Clear
                  </Button>
                )}
              </div>
            </Field>
            <Field>
              <FieldLabel>Text color</FieldLabel>
              <div className="flex items-center gap-2">
                <div className="grid flex-1 grid-cols-[32px_1fr] items-center gap-2">
                  <input
                    type="color"
                    value={block.textColor ?? document.settings.textColor}
                    onChange={(e) => setBlock((b) => ({ ...b, textColor: e.target.value }))}
                    className="h-8 w-8 cursor-pointer rounded border p-0.5"
                  />
                  <Input
                    value={block.textColor ?? ""}
                    placeholder="Default"
                    onChange={(e) => setBlock((b) => ({ ...b, textColor: e.target.value || undefined }))}
                    className="h-8 font-mono text-xs"
                  />
                </div>
                {block.textColor && (
                  <Button variant="ghost" size="sm" className="shrink-0 text-xs"
                    onClick={() => setBlock((b) => ({ ...b, textColor: undefined }))}>
                    Clear
                  </Button>
                )}
              </div>
            </Field>
            <SettingNumberField
              id="block-pt" label="Padding top" value={block.paddingTop ?? 0}
              min={0} max={80} step={4} suffix="px"
              onChange={(v) => setBlock((b) => ({ ...b, paddingTop: v || undefined }))}
            />
            <SettingNumberField
              id="block-pb" label="Padding bottom" value={block.paddingBottom ?? 0}
              min={0} max={80} step={4} suffix="px"
              onChange={(v) => setBlock((b) => ({ ...b, paddingBottom: v || undefined }))}
            />
          </FieldGroup>
        </div>
      </ScrollArea>
    </>
  );
}

// ─── Global settings sheet ────────────────────────────────────────────────────

function GlobalSettingsSheet({
  document,
  onUpdateDocument,
}: {
  document: EmailDocument;
  onUpdateDocument: (updater: (current: EmailDocument) => EmailDocument) => void;
}) {
  const updateSettings = (updater: (s: EmailDocumentSettings) => EmailDocumentSettings) => {
    onUpdateDocument((current) => touchDocument({ ...current, settings: updater(current.settings) }));
  };
  const setSetting = <K extends keyof EmailDocumentSettings>(key: K, value: EmailDocumentSettings[K]) => {
    updateSettings((s) => ({ ...s, [key]: value }));
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} data-icon="inline-start" />
          Settings
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[380px] sm:max-w-[380px]">
        <SheetHeader>
          <SheetTitle>Email settings</SheetTitle>
          <SheetDescription>Global settings for this campaign.</SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 px-6 pb-6">
          <div className="flex flex-col gap-4 pt-2">
            <Field>
              <FieldLabel htmlFor="doc-name">Campaign name</FieldLabel>
              <Input
                id="doc-name"
                value={document.name}
                onChange={(e) => onUpdateDocument((c) => touchDocument({ ...c, name: e.target.value }))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="preview-text">Preview text</FieldLabel>
              <Textarea id="preview-text" rows={2} value={document.settings.previewText}
                onChange={(e) => setSetting("previewText", e.target.value)} />
            </Field>
            <Separator />
            <Field><FieldTitle>Layout</FieldTitle></Field>
            <SettingNumberField id="max-width" label="Canvas width" value={document.settings.maxWidth} min={480} max={760} step={20} suffix="px" onChange={(v) => setSetting("maxWidth", v)} />
            <SettingNumberField id="padding" label="Padding" value={document.settings.padding} min={0} max={48} step={4} suffix="px" onChange={(v) => setSetting("padding", v)} />
            <SettingNumberField id="radius" label="Border radius" value={document.settings.radius} min={0} max={24} step={1} suffix="px" onChange={(v) => setSetting("radius", v)} />
            <Separator />
            <Field><FieldTitle>Colors &amp; typography</FieldTitle></Field>
            <SettingColorField id="bg-color" label="Outer background" value={document.settings.backgroundColor} onChange={(v) => setSetting("backgroundColor", v)} />
            <SettingColorField id="content-color" label="Email background" value={document.settings.contentColor} onChange={(v) => setSetting("contentColor", v)} />
            <SettingColorField id="text-color" label="Text color" value={document.settings.textColor} onChange={(v) => setSetting("textColor", v)} />
            <SettingColorField id="accent-color" label="Accent / button color" value={document.settings.accentColor} onChange={(v) => setSetting("accentColor", v)} />
            <Field>
              <FieldLabel>Font family</FieldLabel>
              <Select value={document.settings.fontFamily} onValueChange={(v) => setSetting("fontFamily", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONT_FAMILIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Separator />
            <Field><FieldTitle>Button defaults</FieldTitle></Field>
            <SettingNumberField id="btn-font-size" label="Font size" value={document.settings.buttonFontSize} min={12} max={22} step={1} suffix="px" onChange={(v) => setSetting("buttonFontSize", v)} />
            <SettingNumberField id="btn-padding-y" label="Vertical padding" value={document.settings.buttonPaddingY} min={6} max={28} step={1} suffix="px" onChange={(v) => setSetting("buttonPaddingY", v)} />
            <SettingNumberField id="btn-padding-x" label="Horizontal padding" value={document.settings.buttonPaddingX} min={8} max={40} step={1} suffix="px" onChange={(v) => setSetting("buttonPaddingX", v)} />
            <SettingNumberField id="btn-radius" label="Border radius" value={document.settings.buttonRadius} min={0} max={24} step={1} suffix="px" onChange={(v) => setSetting("buttonRadius", v)} />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// ─── Preview dialog ───────────────────────────────────────────────────────────

function PreviewDialog({ compiled }: { compiled: { html: string; text: string } }) {
  const [mode, setMode] = React.useState<PreviewMode>("desktop");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <HugeiconsIcon icon={EyeIcon} strokeWidth={2} data-icon="inline-start" />
          Preview
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[90vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle>Email preview</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1">
          <PreviewPane html={compiled.html} mode={mode} onModeChange={setMode} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PreviewPane({ html, mode, onModeChange }: { html: string; mode: PreviewMode; onModeChange: (m: PreviewMode) => void }) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = React.useState(620);

  const previewHtml = React.useMemo(() => {
    if (html.includes("<head>")) return html.replace("<head>", '<head><base href="/">');
    return `<base href="/">${html}`;
  }, [html]);

  const measureIframe = React.useCallback(() => {
    try {
      const doc = iframeRef.current?.contentDocument;
      const h = Math.max(doc?.documentElement.scrollHeight ?? 0, doc?.body.scrollHeight ?? 0);
      if (h > 0) setIframeHeight(Math.max(620, h));
    } catch { setIframeHeight(620); }
  }, []);

  React.useEffect(() => {
    const t = window.setTimeout(measureIframe, 50);
    return () => window.clearTimeout(t);
  }, [previewHtml, measureIframe]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <ToggleGroup type="single" value={mode} onValueChange={(v) => { if (v) onModeChange(v as PreviewMode); }} variant="outline">
          <ToggleGroupItem value="desktop">
            <HugeiconsIcon icon={ComputerIcon} strokeWidth={2} data-icon="inline-start" />
            Desktop
          </ToggleGroupItem>
          <ToggleGroupItem value="mobile">
            <HugeiconsIcon icon={SmartPhone01Icon} strokeWidth={2} data-icon="inline-start" />
            Mobile
          </ToggleGroupItem>
        </ToggleGroup>
        <Badge variant="outline" className="ml-auto text-xs">Live preview</Badge>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-zinc-100 p-4">
        <div className={cn(
          "mx-auto overflow-hidden rounded-xl border bg-white shadow-md transition-[max-width]",
          mode === "mobile" ? "max-w-[390px]" : "max-w-[720px]",
        )}>
          <div className="border-b bg-white px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white">C</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">Newsletter</p>
                <p className="truncate text-xs text-muted-foreground">newsletter@example.com</p>
              </div>
            </div>
          </div>
          <div className="bg-zinc-100 p-3">
            <iframe
              ref={iframeRef}
              title="Email preview"
              srcDoc={previewHtml}
              scrolling="no"
              sandbox="allow-same-origin"
              onLoad={measureIframe}
              className="w-full rounded-lg border bg-white shadow-sm"
              style={{ height: iframeHeight }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Block field editors ──────────────────────────────────────────────────────

function TextBlockFields({ block, onChange }: { block: TextBlock; onChange: (u: (b: EmailBlock) => EmailBlock) => void }) {
  return (
    <>
      <Field>
        <FieldTitle>Content</FieldTitle>
        <FieldDescription>Click the block on the canvas to edit heading and body inline.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="eyebrow">Eyebrow label</FieldLabel>
        <Input id="eyebrow" value={block.eyebrow ?? ""} onChange={(e) => onChange((b) => ({ ...b, eyebrow: e.target.value }) as TextBlock)} />
      </Field>
      <AlignmentField value={block.align} onChange={(align) => onChange((b) => ({ ...b, align }) as TextBlock)} />
    </>
  );
}

function ImageBlockFields({ block, onChange }: { block: ImageBlock; onChange: (u: (b: EmailBlock) => EmailBlock) => void }) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor="img-src">Image URL</FieldLabel>
        <Input id="img-src" value={block.src} onChange={(e) => onChange((b) => ({ ...b, src: e.target.value }) as ImageBlock)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="img-alt">Alt text</FieldLabel>
        <Input id="img-alt" value={block.alt} onChange={(e) => onChange((b) => ({ ...b, alt: e.target.value }) as ImageBlock)} />
      </Field>
      <Field>
        <FieldLabel>Width</FieldLabel>
        <FieldContent>
          <Slider value={[block.width]} min={40} max={100} step={5} onValueChange={([w]) => onChange((b) => ({ ...b, width: w }) as ImageBlock)} />
          <FieldDescription>{block.width}% of the email container</FieldDescription>
        </FieldContent>
      </Field>
    </>
  );
}

function ButtonBlockFields({ block, onChange }: { block: ButtonBlock; onChange: (u: (b: EmailBlock) => EmailBlock) => void }) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor="btn-label">Label</FieldLabel>
        <Input id="btn-label" value={block.label} onChange={(e) => onChange((b) => ({ ...b, label: e.target.value }) as ButtonBlock)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="btn-href">Link URL</FieldLabel>
        <Input id="btn-href" value={block.href} onChange={(e) => onChange((b) => ({ ...b, href: e.target.value }) as ButtonBlock)} />
      </Field>
      <AlignmentField value={block.align} onChange={(align) => onChange((b) => ({ ...b, align }) as ButtonBlock)} />
    </>
  );
}

function ArticleCardBlockFields({ block, onChange }: { block: ArticleCardBlock; onChange: (u: (b: EmailBlock) => EmailBlock) => void }) {
  return (
    <>
      <Field>
        <FieldTitle>Content</FieldTitle>
        <FieldDescription>Click the block on the canvas to edit inline.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="article-img">Image URL</FieldLabel>
        <Input id="article-img" value={block.imageSrc} onChange={(e) => onChange((b) => ({ ...b, imageSrc: e.target.value }) as ArticleCardBlock)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="article-alt">Image alt</FieldLabel>
        <Input id="article-alt" value={block.imageAlt} onChange={(e) => onChange((b) => ({ ...b, imageAlt: e.target.value }) as ArticleCardBlock)} />
      </Field>
      <Field>
        <FieldLabel>Image position</FieldLabel>
        <ToggleGroup type="single" value={block.imagePosition}
          onValueChange={(v) => { if (v) onChange((b) => ({ ...b, imagePosition: v }) as ArticleCardBlock); }}
          variant="outline">
          <ToggleGroupItem value="left">Image left</ToggleGroupItem>
          <ToggleGroupItem value="right">Image right</ToggleGroupItem>
        </ToggleGroup>
      </Field>
      <Field>
        <FieldLabel htmlFor="article-link-label">Link label</FieldLabel>
        <Input id="article-link-label" value={block.linkLabel} onChange={(e) => onChange((b) => ({ ...b, linkLabel: e.target.value }) as ArticleCardBlock)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="article-link-url">Link URL</FieldLabel>
        <Input id="article-link-url" value={block.linkUrl} onChange={(e) => onChange((b) => ({ ...b, linkUrl: e.target.value }) as ArticleCardBlock)} />
      </Field>
    </>
  );
}

function ColumnsBlockFields({ block, onChange }: { block: ColumnsBlock; onChange: (u: (b: EmailBlock) => EmailBlock) => void }) {
  void onChange;
  return (
    <Field>
      <FieldTitle>Content</FieldTitle>
      <FieldDescription>
        {block.columns.length} columns. Click the block on the canvas to edit each column inline.
      </FieldDescription>
    </Field>
  );
}

function SpacerBlockFields({ block, onChange }: { block: SpacerBlock; onChange: (u: (b: EmailBlock) => EmailBlock) => void }) {
  return (
    <Field>
      <FieldLabel>Height</FieldLabel>
      <FieldContent>
        <Slider value={[block.height]} min={8} max={80} step={4} onValueChange={([h]) => onChange((b) => ({ ...b, height: h }) as SpacerBlock)} />
        <FieldDescription>{block.height}px vertical gap</FieldDescription>
      </FieldContent>
    </Field>
  );
}

function RawHtmlBlockFields({ block, onChange }: { block: RawHtmlBlock; onChange: (u: (b: EmailBlock) => EmailBlock) => void }) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor="raw-label">Label</FieldLabel>
        <Input id="raw-label" value={block.label} onChange={(e) => onChange((b) => ({ ...b, label: e.target.value }) as RawHtmlBlock)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="raw-html">HTML</FieldLabel>
        <Textarea id="raw-html" rows={7} value={block.html} onChange={(e) => onChange((b) => ({ ...b, html: e.target.value }) as RawHtmlBlock)} />
      </Field>
    </>
  );
}

function AlignmentField({ value, onChange }: { value: TextAlign; onChange: (a: TextAlign) => void }) {
  return (
    <Field>
      <FieldLabel>Alignment</FieldLabel>
      <ToggleGroup type="single" value={value}
        onValueChange={(v) => { if (v) onChange(v as TextAlign); }}
        variant="outline">
        <ToggleGroupItem value="left">Left</ToggleGroupItem>
        <ToggleGroupItem value="center">Center</ToggleGroupItem>
        <ToggleGroupItem value="right">Right</ToggleGroupItem>
      </ToggleGroup>
    </Field>
  );
}

// ─── Reusable setting field primitives ───────────────────────────────────────

function SettingNumberField({ id, label, value, min, max, step, suffix, onChange }: {
  id: string; label: string; value: number; min: number; max: number; step: number; suffix: string;
  onChange: (v: number) => void;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="grid grid-cols-[1fr_88px] items-center gap-2">
        <input type="range" value={value} min={min} max={max} step={step}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          className="h-1.5 w-full cursor-pointer accent-primary" />
        <div className="relative">
          <Input id={id} type="number" value={value} min={min} max={max} step={step}
            onChange={(e) => onChange(clamp(Number(e.target.value)))}
            className="h-8 pr-7 text-right" />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>
        </div>
      </div>
    </Field>
  );
}

function SettingColorField({ id, label, value, onChange }: {
  id: string; label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="grid grid-cols-[32px_1fr] items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="h-8 w-8 cursor-pointer rounded border p-0.5" />
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-8 font-mono text-xs" />
      </div>
    </Field>
  );
}

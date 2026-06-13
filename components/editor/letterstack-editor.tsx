"use client";

import * as React from "react";
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
  initialEmailDocument,
  isEmailDocument,
  reorderBlocks,
  removeBlock,
  STORAGE_KEY,
  touchDocument,
  type EmailBlock,
  type EmailDocument,
} from "@/lib/email/document";

import { type ActivePanel } from "./editor-types";
import { GlobalSettingsSheet } from "./settings-sheet";
import { NavButton } from "./nav-button";
import { PreviewDialog } from "./preview-dialog";
import { SidePanel } from "./side-panel";
import { SortableBlockList } from "./sortable-block-list";

export function LetterStackEditor() {
  const [document, setDocument] = React.useState<EmailDocument>(initialEmailDocument);
  const [isHydrated, setIsHydrated] = React.useState(false);
  const [selectedBlockId, setSelectedBlockId] = React.useState(
    initialEmailDocument.blocks[0]?.id ?? "",
  );
  const [activePanel, setActivePanel] = React.useState<ActivePanel>("blocks");
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "saved">("idle");
  const [copied, setCopied] = React.useState(false);

  const compiled = React.useMemo(() => compileEmailDocument(document), [document]);
  const selectedBlock = document.blocks.find((b) => b.id === selectedBlockId);
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

  const togglePanel = (panel: ActivePanel) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  const copyHtml = async () => {
    await navigator.clipboard.writeText(compiled.html);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
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

      {/* ── Body ──────────────────────────────────────────────────────────── */}
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
                onSelectBlock={(id) => {
                  setSelectedBlockId(id);
                  setActivePanel("blocks");
                }}
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

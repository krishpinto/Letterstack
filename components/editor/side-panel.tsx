"use client";

import type { EmailDocument } from "@/lib/email/document";
import type { ActivePanel } from "./editor-types";
import { BlockInspector } from "./block-inspector";
import { BlockPalette } from "./block-palette";
import { OptimizePanel } from "./optimize-panel";
import { SectionsPanel } from "./sections-panel";
import { StylesPanel } from "./styles-panel";
import type { EmailBlock } from "@/lib/email/document";

interface SidePanelProps {
  activePanel: ActivePanel;
  document: EmailDocument;
  selectedBlock: EmailBlock | undefined;
  selectedIndex: number;
  onAdd: (type: EmailBlock["type"]) => void;
  onBack: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdateDocument: (updater: (current: EmailDocument) => EmailDocument) => void;
}

export function SidePanel({
  activePanel,
  document,
  selectedBlock,
  selectedIndex,
  onAdd,
  onBack,
  onMoveUp,
  onMoveDown,
  onUpdateDocument,
}: SidePanelProps) {
  const showPalette = activePanel === "blocks" && !selectedBlock;
  const showInspector = activePanel === "blocks" && !!selectedBlock;

  return (
    <div
      className="relative z-10 shrink-0 overflow-hidden rounded-r-2xl bg-card"
      style={{
        width: activePanel !== null ? 320 : 0,
        transition: "width 200ms cubic-bezier(0.23, 1, 0.32, 1), box-shadow 200ms ease",
        boxShadow: activePanel !== null ? "4px 0 24px rgba(0,0,0,0.07)" : "none",
      }}
    >
      <div className="flex h-full w-[320px] flex-col">
        {showPalette && (
          <BlockPalette onAdd={onAdd} />
        )}

        {showInspector && selectedBlock && (
          <BlockInspector
            block={selectedBlock}
            document={document}
            onBack={onBack}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onUpdateDocument={onUpdateDocument}
          />
        )}

        {activePanel === "sections" && (
          <SectionsPanel />
        )}

        {activePanel === "styles" && (
          <StylesPanel document={document} onUpdateDocument={onUpdateDocument} />
        )}

        {activePanel === "optimize" && (
          <OptimizePanel document={document} />
        )}
      </div>
    </div>
  );
}

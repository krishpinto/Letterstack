"use client";

import type { EmailDocument } from "@/lib/email/document";
import type { ActivePanel } from "./editor-types";
import { BlockInspector } from "./block-inspector";
import { BlockPalette } from "./block-palette";
import { OptimizePanel } from "./optimize-panel";
import { SectionsPanel } from "./sections-panel";
import { StylesPanel } from "./styles-panel";
import type { EmailBlock } from "@/lib/email/document";

/** Left edge of the flyout = width of the icon nav rail. */
const NAV_WIDTH = 56;
const PANEL_WIDTH = 320;
/** Gap between the rail and the floating preview card (visual only — the hit
 *  area still spans it, so it isn't a hover dead zone). */
const PREVIEW_GAP_X = 12;
const PREVIEW_GAP_Y = 14;
const FLYOUT_TRANSITION =
  "top 260ms cubic-bezier(0.22,1,0.36,1), bottom 260ms cubic-bezier(0.22,1,0.36,1), " +
  "left 260ms cubic-bezier(0.22,1,0.36,1), border-radius 260ms ease, " +
  "box-shadow 260ms ease, opacity 180ms ease, transform 220ms cubic-bezier(0.22,1,0.36,1)";

interface SidePanelProps {
  /** Which panel's content to show (hover preview OR pinned). null = closed. */
  panel: ActivePanel;
  /** True while this is a hover preview (floating) rather than pinned (docked). */
  preview: boolean;
  /** Pin the currently-previewed panel — fired when the user clicks inside it. */
  onCommit: () => void;
  document: EmailDocument;
  selectedBlock: EmailBlock | undefined;
  onAdd: (type: EmailBlock["type"]) => void;
  onBack: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdateDocument: (updater: (current: EmailDocument) => EmailDocument) => void;
}

export function SidePanel({
  panel,
  preview,
  onCommit,
  document,
  selectedBlock,
  onAdd,
  onBack,
  onMoveUp,
  onMoveDown,
  onUpdateDocument,
}: SidePanelProps) {
  const open = panel !== null;
  const mode = !open ? "closed" : preview ? "preview" : "docked";

  const showPalette = panel === "blocks" && !selectedBlock;
  const showInspector = panel === "blocks" && !!selectedBlock;

  return (
    // Outer hit area: transparent, flush to the rail and full-height, spanning
    // the card AND its preview gap. The cursor never crosses a dead zone moving
    // from the rail to the floating card, so the hover never drops mid-move.
    <div
      onClick={onCommit}
      className="absolute"
      style={{
        left: NAV_WIDTH,
        top: 0,
        bottom: 0,
        width: PANEL_WIDTH + PREVIEW_GAP_X,
        pointerEvents: open ? "auto" : "none",
      }}
    >
      {/* Visible card. Docked: flush, full height, right corners rounded.
          Preview: inset by the gap on all sides, fully rounded, lifted shadow
          — clearly reads as a temporary floating preview until clicked. */}
      <div
        className="absolute flex flex-col bg-card"
        style={{
          width: PANEL_WIDTH,
          left: mode === "docked" ? 0 : PREVIEW_GAP_X,
          top: mode === "docked" ? 0 : PREVIEW_GAP_Y,
          bottom: mode === "docked" ? 0 : PREVIEW_GAP_Y,
          borderRadius: mode === "docked" ? "0 16px 16px 0" : 18,
          boxShadow:
            mode === "preview"
              ? "0 24px 70px rgba(0,0,0,0.22)"
              : mode === "docked"
              ? "4px 0 24px rgba(0,0,0,0.07)"
              : "none",
          opacity: open ? 1 : 0,
          transform: open ? "translateX(0)" : "translateX(-14px)",
          overflow: "hidden",
          transition: FLYOUT_TRANSITION,
        }}
      >
        {/* Keyed so swapping panels (Blocks → Sections) cross-fades cleanly. */}
        <div
          key={panel ?? "none"}
          className="flex h-full flex-col duration-200 animate-in fade-in-0"
        >
          {showPalette && <BlockPalette onAdd={onAdd} />}

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

          {panel === "sections" && <SectionsPanel />}

          {panel === "styles" && (
            <StylesPanel document={document} onUpdateDocument={onUpdateDocument} />
          )}

          {panel === "optimize" && <OptimizePanel document={document} />}
        </div>
      </div>
    </div>
  );
}

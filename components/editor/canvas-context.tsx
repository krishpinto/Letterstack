"use client";

import * as React from "react";
import type { EmailBlock, EmailDocument } from "@/lib/email/document";

export const CANVAS_ROOT_CONTAINER = "canvas-root";

export type InsertTarget = { containerId: string; index: number };

export type CanvasContextValue = {
  document: EmailDocument;
  selectedBlockId: string;
  /** Where a drag would currently drop, used to draw the insertion line. */
  insertTarget: InsertTarget | null;
  onSelect: (id: string) => void;
  onUpdateBlock: (id: string, updater: (b: EmailBlock) => EmailBlock) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onReorderTop: (from: number, to: number) => void;
  onReorderColumn: (columnId: string, from: number, to: number) => void;
  onAddToColumn: (columnId: string, index: number, type: EmailBlock["type"]) => void;
};

const CanvasContext = React.createContext<CanvasContextValue | null>(null);

export function CanvasProvider({
  value,
  children,
}: {
  value: CanvasContextValue;
  children: React.ReactNode;
}) {
  return <CanvasContext.Provider value={value}>{children}</CanvasContext.Provider>;
}

/**
 * A narrower canvas value for one block, provided by SortableBlockList.
 *
 * The root value holds the whole document, so it changes on every keystroke,
 * and every block reading it re-rendered (and re-sanitized its HTML) on every
 * keystroke in any other block. Blocks read this per-block value instead, which
 * only changes when that block, its selection, or the document's settings
 * change. See BlockItem in sortable-block-list.tsx.
 */
const BlockCanvasContext = React.createContext<CanvasContextValue | null>(null);

export function BlockCanvasProvider({
  value,
  children,
}: {
  value: CanvasContextValue;
  children: React.ReactNode;
}) {
  return <BlockCanvasContext.Provider value={value}>{children}</BlockCanvasContext.Provider>;
}

export function useCanvas(): CanvasContextValue {
  // React.use (unlike useContext) may be called conditionally, and a component
  // only subscribes to the contexts it actually read during render. So a
  // block that finds its per-block value never subscribes to the root value
  // and is not re-rendered when another block changes.
  const scoped = React.use(BlockCanvasContext);
  if (scoped) return scoped;
  const ctx = React.use(CanvasContext);
  if (!ctx) throw new Error("useCanvas must be used within <CanvasProvider>");
  return ctx;
}

/** The root value, for the block list itself. Never the per-block one. */
export function useRootCanvas(): CanvasContextValue {
  const ctx = React.use(CanvasContext);
  if (!ctx) throw new Error("useRootCanvas must be used within <CanvasProvider>");
  return ctx;
}

export function isInsertHere(
  target: InsertTarget | null,
  containerId: string,
  index: number,
): boolean {
  return !!target && target.containerId === containerId && target.index === index;
}

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

export function useCanvas(): CanvasContextValue {
  const ctx = React.useContext(CanvasContext);
  if (!ctx) throw new Error("useCanvas must be used within <CanvasProvider>");
  return ctx;
}

export function isInsertHere(
  target: InsertTarget | null,
  containerId: string,
  index: number,
): boolean {
  return !!target && target.containerId === containerId && target.index === index;
}

"use client";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { cn } from "@/lib/utils";
import type { ColumnsBlock } from "@/lib/email/document";
import { useCanvas } from "./canvas-context";

const GRID = 12; // snap the column boundary to a 12-unit grid across the row

/**
 * Draggable divider between two columns. Adjusts the two adjacent column
 * widths, snapping the boundary to a 12-unit grid and showing guide lines.
 */
export function ColumnResizer({
  columnsBlock,
  leftIndex,
  gap,
}: {
  columnsBlock: ColumnsBlock;
  leftIndex: number;
  gap: number;
}) {
  const ctx = useCanvas();
  const [dragging, setDragging] = React.useState(false);
  const [activeStep, setActiveStep] = React.useState<number | null>(null);
  const [rowRect, setRowRect] = React.useState<DOMRect | null>(null);

  const cols = columnsBlock.columns;
  const total = cols.reduce((s, c) => s + (c.width || 1), 0) || 1;
  const prefix = cols.slice(0, leftIndex).reduce((s, c) => s + (c.width || 1), 0);
  const pairSum = (cols[leftIndex].width || 1) + (cols[leftIndex + 1].width || 1);
  const minW = total * 0.04;

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const rowEl = e.currentTarget.parentElement?.parentElement; // resizer wrap → flex row
    if (!rowEl) return;
    const rect = rowEl.getBoundingClientRect();
    const startX = e.clientX;
    const startLeft = cols[leftIndex].width || 1;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    setRowRect(rect);

    const onMove = (ev: PointerEvent) => {
      const weightPerPx = total / rect.width;
      let newLeft = startLeft + (ev.clientX - startX) * weightPerPx;
      newLeft = clamp(newLeft, minW, pairSum - minW);

      // Snap the global boundary position to the nearest grid line.
      const boundaryFrac = (prefix + newLeft) / total;
      const step = Math.round(boundaryFrac * GRID);
      const snappedLeft = clamp((step / GRID) * total - prefix, minW, pairSum - minW);
      setActiveStep(step);

      ctx.onUpdateBlock(columnsBlock.id, (b) => {
        if (b.type !== "columns") return b;
        const next = [...b.columns];
        next[leftIndex] = { ...next[leftIndex], width: round(snappedLeft) };
        next[leftIndex + 1] = { ...next[leftIndex + 1], width: round(pairSum - snappedLeft) };
        return { ...b, columns: next };
      });
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDragging(false);
      setActiveStep(null);
      setRowRect(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      className="relative z-20 flex shrink-0 items-stretch justify-center"
      style={{ width: Math.max(gap, 8) }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onPointerDown={handlePointerDown}
        aria-label="Resize columns"
        className="group/resizer flex w-full cursor-col-resize touch-none items-center justify-center"
      >
        <span
          className={cn(
            "h-10 w-1 rounded-full transition-colors",
            dragging ? "bg-primary" : "bg-foreground/15 group-hover/resizer:bg-primary/60",
          )}
        />
      </button>

      {dragging && rowRect && <ResizeGuides rect={rowRect} activeStep={activeStep} />}
    </div>
  );
}

function ResizeGuides({ rect, activeStep }: { rect: DOMRect; activeStep: number | null }) {
  if (typeof document === "undefined") return null;
  return ReactDOM.createPortal(
    <div
      className="pointer-events-none fixed z-50"
      style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
    >
      {Array.from({ length: GRID - 1 }, (_, i) => i + 1).map((k) => (
        <div
          key={k}
          className={cn(
            "absolute top-0 h-full w-px -translate-x-1/2",
            k === activeStep ? "bg-primary" : "bg-primary/20",
          )}
          style={{ left: `${(k / GRID) * 100}%` }}
        />
      ))}
    </div>,
    document.body,
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { CanvasBlock, InsertIndicator } from "./canvas-block";
import {
  CANVAS_ROOT_CONTAINER,
  isInsertHere,
  useCanvas,
} from "./canvas-context";

// dnd-kit strategy that disables sibling shifting — the insertion line is the
// single, consistent "where it lands" cue across the canvas and column cells.
const noShift = () => null;

export function SortableBlockList() {
  const ctx = useCanvas();
  const { setNodeRef } = useDroppable({ id: CANVAS_ROOT_CONTAINER });
  const blocks = ctx.document.blocks;

  return (
    <div ref={setNodeRef}>
      <SortableContext items={blocks.map((b) => b.id)} strategy={noShift}>
        {blocks.map((block, index) => (
          <div key={block.id}>
            {isInsertHere(ctx.insertTarget, CANVAS_ROOT_CONTAINER, index) && <InsertIndicator />}
            <CanvasBlock
              block={block}
              total={blocks.length}
              containerId={CANVAS_ROOT_CONTAINER}
            />
          </div>
        ))}
        {isInsertHere(ctx.insertTarget, CANVAS_ROOT_CONTAINER, blocks.length) && <InsertIndicator />}
      </SortableContext>
    </div>
  );
}

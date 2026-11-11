"use client";

import * as React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import type { EmailBlock, EmailDocument } from "@/lib/email/document";
import { CanvasBlock, InsertIndicator } from "./canvas-block";
import {
  BlockCanvasProvider,
  CANVAS_ROOT_CONTAINER,
  isInsertHere,
  useRootCanvas,
  type CanvasContextValue,
} from "./canvas-context";

// dnd-kit strategy that disables sibling shifting — the insertion line is the
// single, consistent "where it lands" cue across the canvas and column cells.
const noShift = () => null;

type BlockActions = Pick<
  CanvasContextValue,
  | "onSelect"
  | "onUpdateBlock"
  | "onDuplicate"
  | "onRemove"
  | "onReorderTop"
  | "onReorderColumn"
  | "onAddToColumn"
>;

export function SortableBlockList() {
  const ctx = useRootCanvas();
  const { setNodeRef } = useDroppable({ id: CANVAS_ROOT_CONTAINER });
  const blocks = ctx.document.blocks;

  // What a block needs from the document is its settings (colors, fonts,
  // padding), not the other blocks. This copy changes only when something
  // other than the blocks changes, so editing one block does not hand every
  // other block a new document. `blocks` is deliberately empty: a block reads
  // its own content from its `block` prop, never from here.
  const { id, name, subject, fromName, fromEmail, settings } = ctx.document;
  const documentShell = React.useMemo<EmailDocument>(
    () => ({ id, name, subject, fromName, fromEmail, settings, updatedAt: "", blocks: [] }),
    [id, name, subject, fromName, fromEmail, settings],
  );

  const {
    onSelect,
    onUpdateBlock,
    onDuplicate,
    onRemove,
    onReorderTop,
    onReorderColumn,
    onAddToColumn,
  } = ctx;
  const actions = React.useMemo<BlockActions>(
    () => ({
      onSelect,
      onUpdateBlock,
      onDuplicate,
      onRemove,
      onReorderTop,
      onReorderColumn,
      onAddToColumn,
    }),
    [onSelect, onUpdateBlock, onDuplicate, onRemove, onReorderTop, onReorderColumn, onAddToColumn],
  );

  return (
    <div ref={setNodeRef}>
      <SortableContext items={blocks.map((b) => b.id)} strategy={noShift}>
        {blocks.map((block, index) => (
          <BlockItem
            key={block.id}
            block={block}
            total={blocks.length}
            isSelected={ctx.selectedBlockId === block.id}
            insertBefore={isInsertHere(ctx.insertTarget, CANVAS_ROOT_CONTAINER, index)}
            documentShell={documentShell}
            actions={actions}
          />
        ))}
        {isInsertHere(ctx.insertTarget, CANVAS_ROOT_CONTAINER, blocks.length) && <InsertIndicator />}
      </SortableContext>
    </div>
  );
}

/**
 * One top-level block. Memoized on its own inputs, and it gives CanvasBlock a
 * per-block canvas value, so typing in one block re-renders that block only.
 * Every prop here must be stable across unrelated edits: `block` keeps its
 * identity unless it was edited (lib/email/document.ts maps the tree and
 * returns untouched blocks as-is; column blocks are the exception, it copies
 * them on every edit, so they still re-render), and the callbacks come from EditorShell's
 * stable handlers.
 */
const BlockItem = React.memo(function BlockItem({
  block,
  total,
  isSelected,
  insertBefore,
  documentShell,
  actions,
}: {
  block: EmailBlock;
  total: number;
  isSelected: boolean;
  insertBefore: boolean;
  documentShell: EmailDocument;
  actions: BlockActions;
}) {
  const value = React.useMemo<CanvasContextValue>(
    () => ({
      ...actions,
      document: documentShell,
      selectedBlockId: isSelected ? block.id : "",
      // Only the list draws insertion lines; nothing inside a block reads this.
      insertTarget: null,
    }),
    [actions, documentShell, isSelected, block.id],
  );

  return (
    <div>
      {insertBefore && <InsertIndicator />}
      <BlockCanvasProvider value={value}>
        <CanvasBlock block={block} total={total} containerId={CANVAS_ROOT_CONTAINER} />
      </BlockCanvasProvider>
    </div>
  );
});

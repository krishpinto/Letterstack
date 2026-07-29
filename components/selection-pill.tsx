"use client";

import { XIcon } from "lucide-react";

// Resend-style floating selection pill: hovers bottom-center above the table
// while rows are selected — count, clear ×, divider, then the bulk actions.
type SelectionPillProps = {
  count: number;
  onClear: () => void;
  children: React.ReactNode;
};

export function SelectionPill({ count, onClear, children }: SelectionPillProps) {
  if (count === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-border bg-popover py-1.5 pl-4 pr-2 text-sm text-popover-foreground shadow-lg">
        <span className="whitespace-nowrap font-medium">{count} selected</span>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          className="ml-1 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <XIcon className="size-3.5" />
        </button>
        <span className="mx-1.5 h-4 w-px shrink-0 bg-border" aria-hidden />
        <span className="flex items-center gap-0.5">{children}</span>
      </div>
    </div>
  );
}

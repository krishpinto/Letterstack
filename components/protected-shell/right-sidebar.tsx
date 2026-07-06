"use client";

import {
  CalendarIcon,
  ChevronDownIcon,
  FilterIcon,
  PanelRightIcon,
  SlidersHorizontalIcon,
  TagIcon,
  UserIcon,
  XIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ─── Filter section ────────────────────────────────────────────────────────────

function FilterSection({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ElementType;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        <Icon className="size-3" />
        {label}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function FilterChip({
  label,
  active,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={cn(
        "flex h-7 w-full items-center gap-2 rounded-md px-2 text-xs transition-colors",
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span className={cn("size-1.5 rounded-full shrink-0", active ? "bg-primary" : "bg-muted-foreground/40")} />
      {label}
    </button>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

type RightSidebarProps = {
  onClose: () => void;
};

export function RightSidebar({ onClose }: RightSidebarProps) {
  return (
    <aside className="flex w-56 shrink-0 flex-col overflow-hidden border-l border-border bg-card">
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <SlidersHorizontalIcon className="size-3.5 text-muted-foreground" />
          Filters
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="h-4 px-1.5 text-[10px] tabular-nums">
            0
          </Badge>
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-foreground"
            onClick={onClose}
            aria-label="Close filters"
          >
            <XIcon className="size-3" />
          </Button>
        </div>
      </div>

      {/* Filter body */}
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
        {/* Status */}
        <FilterSection label="Status" icon={FilterIcon}>
          <FilterChip label="All" active />
          <FilterChip label="Draft" />
          <FilterChip label="Sending" />
          <FilterChip label="Sent" />
          <FilterChip label="Failed" />
        </FilterSection>

        <Separator className="opacity-50" />

        {/* Date */}
        <FilterSection label="Date" icon={CalendarIcon}>
          <FilterChip label="Today" />
          <FilterChip label="This week" />
          <FilterChip label="This month" />
          <FilterChip label="Custom range" />
        </FilterSection>

        <Separator className="opacity-50" />

        {/* Tags / Labels */}
        <FilterSection label="Labels" icon={TagIcon}>
          <FilterChip label="Newsletter" />
          <FilterChip label="Promotional" />
          <FilterChip label="Transactional" />
        </FilterSection>

        <Separator className="opacity-50" />

        {/* Sender */}
        <FilterSection label="Sender" icon={UserIcon}>
          <FilterChip label="All senders" active />
        </FilterSection>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-border p-2">
        <Button
          variant="ghost"
          size="xs"
          className="w-full text-muted-foreground hover:text-foreground"
        >
          Clear all filters
        </Button>
      </div>
    </aside>
  );
}

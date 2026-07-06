"use client";

import { usePathname } from "next/navigation";
import { PanelLeftIcon, PanelRightIcon, SearchIcon, SlidersHorizontalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ─── Page metadata ────────────────────────────────────────────────────────────

const PAGE_METADATA: Record<string, { title: string; emoji: string }> = {
  "/dashboard": { title: "Dashboard", emoji: "🏠" },
  "/dashboard/campaigns": { title: "Campaigns", emoji: "📤" },
  "/dashboard/audience": { title: "Audience", emoji: "👥" },
  "/dashboard/contacts": { title: "Audience", emoji: "👥" },
  "/dashboard/templates": { title: "Templates", emoji: "📋" },
  "/dashboard/automations": { title: "Automations", emoji: "⚡" },
  "/dashboard/analytics": { title: "Analytics", emoji: "📊" },
  "/dashboard/domains": { title: "Domains", emoji: "🌐" },
  "/dashboard/settings": { title: "Settings", emoji: "⚙️" },
};

function getPageMeta(pathname: string) {
  if (PAGE_METADATA[pathname]) return PAGE_METADATA[pathname];
  const prefixMatch = Object.entries(PAGE_METADATA).find(
    ([key]) => key !== "/dashboard" && pathname.startsWith(key),
  );
  return prefixMatch ? prefixMatch[1] : { title: "Dashboard", emoji: "📂" };
}

// ─── Component ────────────────────────────────────────────────────────────────

type ContentHeaderProps = {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  onToggleRight: () => void;
  rightOpen: boolean;
  actions?: React.ReactNode;
  className?: string;
};

export function ContentHeader({
  onToggleSidebar,
  sidebarOpen,
  onToggleRight,
  rightOpen,
  actions,
  className,
}: ContentHeaderProps) {
  const pathname = usePathname();
  const meta = getPageMeta(pathname);

  return (
    <div
      className={cn(
        "flex h-10 shrink-0 items-center gap-1.5 border-b border-border bg-muted/50 px-2",
        className,
      )}
    >
      {/* Left sidebar toggle */}
      <Button
        variant="ghost"
        size="icon-xs"
        className={cn(
          "shrink-0 text-muted-foreground hover:text-foreground transition-colors",
          !sidebarOpen && "text-foreground",
        )}
        onClick={onToggleSidebar}
        aria-label={sidebarOpen ? "Collapse left sidebar" : "Expand left sidebar"}
      >
        <PanelLeftIcon className="size-3.5" />
      </Button>
      <Separator orientation="vertical" className="h-3.5" />

      {/* Breadcrumb / title */}
      <div className="flex items-center gap-1 text-sm">
        <span className="text-xs leading-none" aria-hidden>
          {meta.emoji}
        </span>
        <span className="text-xs font-medium text-foreground">{meta.title}</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-foreground"
        >
          <SearchIcon className="size-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="xs"
          className="gap-1 text-muted-foreground hover:text-foreground"
        >
          <SlidersHorizontalIcon className="size-3" />
          Filters
        </Button>

        {/* Page-level CTAs slot */}
        {actions}

        {/* Right sidebar toggle */}
        <Separator orientation="vertical" className="mx-0.5 h-3.5" />
        <Button
          variant="ghost"
          size="icon-xs"
          className={cn(
            "shrink-0 text-muted-foreground hover:text-foreground transition-colors",
            rightOpen && "text-foreground bg-muted",
          )}
          onClick={onToggleRight}
          aria-label={rightOpen ? "Close filters panel" : "Open filters panel"}
        >
          <PanelRightIcon className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

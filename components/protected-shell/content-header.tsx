"use client";

import { usePathname } from "next/navigation";
import {
  BarChart3Icon,
  GlobeIcon,
  HomeIcon,
  LayoutTemplateIcon,
  MailPlusIcon,
  PanelLeftIcon,
  SendIcon,
  SettingsIcon,
  UsersIcon,
  WorkflowIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ─── Page metadata ────────────────────────────────────────────────────────────

const PAGE_METADATA: Record<string, { title: string; icon: React.ElementType }> = {
  "/dashboard": { title: "Dashboard", icon: HomeIcon },
  "/dashboard/campaigns": { title: "Campaigns", icon: SendIcon },
  "/dashboard/audience": { title: "Audience", icon: UsersIcon },
  "/dashboard/contacts": { title: "Audience", icon: UsersIcon },
  "/dashboard/templates": { title: "Templates", icon: LayoutTemplateIcon },
  "/dashboard/automations": { title: "Automations", icon: WorkflowIcon },
  "/dashboard/forms": { title: "Forms", icon: MailPlusIcon },
  "/dashboard/analytics": { title: "Analytics", icon: BarChart3Icon },
  "/dashboard/domains": { title: "Domains", icon: GlobeIcon },
  "/dashboard/settings": { title: "Settings", icon: SettingsIcon },
};

function getPageMeta(pathname: string) {
  if (PAGE_METADATA[pathname]) return PAGE_METADATA[pathname];
  const prefixMatch = Object.entries(PAGE_METADATA).find(
    ([key]) => key !== "/dashboard" && pathname.startsWith(key),
  );
  return prefixMatch ? prefixMatch[1] : { title: "Dashboard", icon: HomeIcon };
}

// ─── Component ────────────────────────────────────────────────────────────────

type ContentHeaderProps = {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  actions?: React.ReactNode;
  className?: string;
};

export function ContentHeader({
  onToggleSidebar,
  sidebarOpen,
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
      <div className="flex items-center gap-1.5 text-sm">
        <meta.icon className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="text-xs font-medium text-foreground">{meta.title}</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Page-level CTAs slot */}
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  BarChart3Icon,
  GlobeIcon,
  LayoutTemplateIcon,
  SendIcon,
  SettingsIcon,
  UsersIcon,
  WorkflowIcon,
} from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type RailNavItem = {
  href: string;
  icon: React.ElementType;
  label: string;
  matchPrefix?: boolean;
};

const NAV_ITEMS: RailNavItem[] = [
  {
    href: "/dashboard/campaigns",
    icon: SendIcon,
    label: "Campaigns",
    matchPrefix: true,
  },
  {
    href: "/dashboard/audience",
    icon: UsersIcon,
    label: "Audience",
    matchPrefix: true,
  },
  {
    href: "/dashboard/templates",
    icon: LayoutTemplateIcon,
    label: "Templates",
    matchPrefix: true,
  },
  {
    href: "/dashboard/automations",
    icon: WorkflowIcon,
    label: "Automations",
    matchPrefix: true,
  },
  {
    href: "/dashboard/analytics",
    icon: BarChart3Icon,
    label: "Analytics",
    matchPrefix: true,
  },
  {
    href: "/dashboard/domains",
    icon: GlobeIcon,
    label: "Domains",
    matchPrefix: true,
  },
];

const BOTTOM_ITEMS: RailNavItem[] = [
  {
    href: "/dashboard/settings",
    icon: SettingsIcon,
    label: "Settings",
    matchPrefix: true,
  },
];

function RailButton({
  href,
  icon: Icon,
  label,
  active,
}: RailNavItem & { active: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          className={cn(
            "flex size-9 items-center justify-center rounded-lg transition-all duration-150",
            active
              ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
              : "text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
          )}
        >
          <Icon className="size-4" />
          <span className="sr-only">{label}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function IconRail() {
  const pathname = usePathname();

  function isActive(item: RailNavItem) {
    if (item.matchPrefix) return pathname.startsWith(item.href);
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }

  return (
    <TooltipProvider delayDuration={400}>
      <aside className="flex w-11 shrink-0 flex-col items-center py-2">
        {/* Logo mark */}
        <Link
          href="/dashboard"
          className="mb-3 flex size-9 items-center justify-center rounded-lg hover:bg-sidebar-accent/50 transition-colors"
        >
          <span className="text-xs font-black tracking-tighter text-primary leading-none select-none">
            LS
          </span>
        </Link>

        {/* Primary nav */}
        <nav className="flex flex-1 flex-col items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <RailButton key={item.href} {...item} active={isActive(item)} />
          ))}
        </nav>

        {/* Bottom nav — separated from primary */}
        <nav className="flex flex-col items-center gap-1 pb-1">
          <Separator className="mb-1 w-5" />
          {BOTTOM_ITEMS.map((item) => (
            <RailButton key={item.href} {...item} active={isActive(item)} />
          ))}
        </nav>
      </aside>
    </TooltipProvider>
  );
}

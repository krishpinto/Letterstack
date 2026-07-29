"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  GlobeIcon,
  LayoutDashboardIcon,
  LayoutTemplateIcon,
  MailPlusIcon,
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
  /** Additional path prefixes that count as this module (e.g. analytics → Campaigns). */
  extraPrefixes?: string[];
};

const NAV_ITEMS: RailNavItem[] = [
  {
    href: "/dashboard/campaigns",
    icon: SendIcon,
    label: "Campaigns",
    matchPrefix: true,
    extraPrefixes: ["/dashboard/analytics"],
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
    href: "/dashboard/forms",
    icon: MailPlusIcon,
    label: "Forms",
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
    if (item.extraPrefixes?.some((prefix) => pathname.startsWith(prefix))) {
      return true;
    }
    if (item.matchPrefix) return pathname.startsWith(item.href);
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }

  return (
    <TooltipProvider delayDuration={400}>
      <aside className="flex w-11 shrink-0 flex-col items-center py-2">
        {/* Dashboard home */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/dashboard"
              className={cn(
                "mb-3 flex size-9 items-center justify-center rounded-lg transition-colors",
                pathname === "/dashboard"
                  ? "bg-sidebar-accent text-primary shadow-sm"
                  : "text-primary hover:bg-sidebar-accent/50",
              )}
            >
              <LayoutDashboardIcon className="size-4" />
              <span className="sr-only">Dashboard</span>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8} className="text-xs">
            Dashboard
          </TooltipContent>
        </Tooltip>

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

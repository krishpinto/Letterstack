"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboardIcon } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { BOTTOM_ITEMS, NAV_ITEMS, isRailItemActive } from "./icon-rail";
import { NavSidebar } from "./nav-sidebar";

/**
 * The phone layout's navigation. Below `md` the icon rail and the module
 * sidebar don't fit beside the page (together they took ~250px of a 375px
 * screen), so both move into this sheet, opened from the top bar.
 *
 * The rail's modules come first, with labels since there is room for them
 * here; the current module's own sidebar (views, folders, recent campaigns)
 * follows, so nothing reachable on desktop is lost on a phone.
 */
export function MobileNav({
  open,
  onOpenChange,
  showModuleSidebar,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** False on routes that hide the module sidebar on desktop too. */
  showModuleSidebar: boolean;
}) {
  const pathname = usePathname();

  // Close after navigating. Most links change the pathname; the sidebar's
  // filter links only change the query string, which the click handler
  // below covers.
  useEffect(() => {
    onOpenChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="gap-0 overflow-y-auto p-0"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a[href]")) onOpenChange(false);
        }}
      >
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="text-sm">LetterStack</SheetTitle>
          <SheetDescription className="sr-only">Main navigation</SheetDescription>
        </SheetHeader>

        <nav aria-label="Main" className="flex flex-col gap-0.5 p-2">
          <MobileNavLink
            href="/dashboard"
            icon={LayoutDashboardIcon}
            label="Dashboard"
            active={pathname === "/dashboard"}
          />
          {[...NAV_ITEMS, ...BOTTOM_ITEMS].map((item) => (
            <MobileNavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={isRailItemActive(item, pathname)}
            />
          ))}
        </nav>

        {showModuleSidebar && (
          // The sidebars are built as fixed-width desktop asides; stretch
          // them to the sheet instead of re-implementing each one.
          <div className="flex min-h-0 flex-1 border-t border-border [&>aside]:w-full [&>aside]:border-r-0">
            <NavSidebar />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MobileNavLink({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </Link>
  );
}

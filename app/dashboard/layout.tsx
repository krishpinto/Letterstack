"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import {
  Megaphone,
  LayoutTemplate,
  Users,
  BarChart3,
  Plus,
  PanelLeftClose,
  PanelLeft,
  Settings,
  LogOut,
  Check,
  Search,
  Bell,
  HelpCircle,
  Home,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Plane-style shell built as a fixed OUTER FRAME + an inner toggleable sidebar:
//
//  ┌────┬──────────── navbar (constant top of frame) ─────────────┐
//  │    ├──────────────┬──────────────────────────────────────────┤
//  │rail│ toggle sidebar│  breadcrumb subheader                    │
//  │ (L)│  (inside the  │  ──────────────────────────────────────  │
//  │    │   frame)      │  page content                            │
//  └────┴──────────────┴──────────────────────────────────────────┘
//
// The rail (left) and navbar (top) form a constant L-shaped outline — their
// borders NEVER move. The toggleable sidebar opens/closes *inside* that frame,
// so toggling it only shifts the page content, never the frame.

type NavItem = { href: string; label: string; icon: LucideIcon };

// Rail = the always-visible primary destinations.
const RAIL_NAV: NavItem[] = [
  { href: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
];
// Toggle sidebar = the rest (no duplicates of the rail).
const SIDEBAR_NAV: NavItem[] = [
  { href: "/dashboard/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/dashboard/contacts", label: "Audience", icon: Users },
];
const SETTINGS: NavItem = { href: "/dashboard/settings", label: "Settings", icon: Settings };
const ALL = [...RAIL_NAV, ...SIDEBAR_NAV, SETTINGS];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("ls-sidebar-collapsed") === "1") setCollapsed(true);
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("ls-sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

  const title = ALL.find((n) => pathname.startsWith(n.href))?.label ?? "Dashboard";
  const who = session?.user?.name || session?.user?.email || "";
  const email = session?.user?.email ?? "";
  const initials = who.slice(0, 1).toUpperCase() || "L";

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-zinc-100 text-zinc-900">
      {/* ── Navbar: flows into the chrome (rail/sidebar share its bg) ── */}
      <header className="flex h-12 shrink-0 items-center gap-2 bg-zinc-100 px-3">
        <WorkspaceSwitcher email={email} initials={initials} who={who} />
        <div className="flex-1" />
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" strokeWidth={1.8} />
          <input
            placeholder="Search…"
            className="h-8 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-700 outline-none placeholder:text-zinc-400 focus:border-indigo-300"
          />
        </div>
        <div className="flex flex-1 items-center justify-end gap-0.5">
          <IconButton title="Notifications">
            <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </IconButton>
          <IconButton title="Help">
            <HelpCircle className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </IconButton>
          <AccountMenu email={email} initials={initials} who={who} />
        </div>
      </header>

      {/* ── Body: rail + sidebar (chrome) + rounded inset content panel ──── */}
      <div className="flex min-h-0 flex-1">
        {/* Rail — chrome; line on its right */}
        <aside className="flex w-[68px] shrink-0 flex-col items-center justify-between border-r border-zinc-200 bg-zinc-100 pb-3">
          <div className="flex w-full flex-col items-center gap-1">
            {RAIL_NAV.map((item) => (
              <RailItem key={item.href} item={item} active={pathname.startsWith(item.href)} />
            ))}
          </div>
          <RailItem item={SETTINGS} active={pathname.startsWith(SETTINGS.href)} />
        </aside>

        {/* Toggleable sidebar — chrome; line on its right */}
        {!collapsed && (
          <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-zinc-100 pb-3">
            <div className="px-3 pt-1">
              <Link
                href="/editor-new"
                className="flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
              >
                <Plus className="h-4 w-4 text-zinc-500" strokeWidth={2} /> New campaign
              </Link>
            </div>

            <nav className="mt-3 flex flex-col gap-0.5 px-3">
              {SIDEBAR_NAV.map((item) => (
                <SidebarLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
              ))}
            </nav>
          </aside>
        )}

        {/* Content panel — white, inset, curved top-left; breadcrumb is its
            own strip (line below); page content sits under it. */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-tl-xl border-l border-t border-zinc-200 bg-white">
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-zinc-200 px-3 text-sm">
            <button
              onClick={toggle}
              title={collapsed ? "Open sidebar" : "Collapse sidebar"}
              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            >
              {collapsed ? (
                <PanelLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
              ) : (
                <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.8} />
              )}
            </button>
            <Home className="h-4 w-4 text-zinc-400" strokeWidth={1.8} />
            <span className="font-medium text-zinc-700">{title}</span>
          </div>
          <main className="min-w-0 flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}

// ── Rail item (icon box + label below) ───────────────────────────────────────

function RailItem({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link href={item.href} className="group flex w-full flex-col items-center gap-1 rounded-lg py-1" title={item.label}>
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
          active ? "bg-white text-indigo-600 shadow-sm" : "text-zinc-400 group-hover:bg-zinc-200 group-hover:text-zinc-700",
        )}
      >
        <item.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
      </span>
      <span className={cn("text-[10.5px] font-medium leading-none", active ? "text-zinc-800" : "text-zinc-500")}>
        {item.label}
      </span>
    </Link>
  );
}

// ── Toggleable sidebar link (icon + label row) ───────────────────────────────

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
        active ? "bg-white font-medium text-zinc-900 shadow-sm" : "text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-900",
      )}
    >
      <item.icon className={cn("h-[17px] w-[17px] shrink-0", active ? "text-indigo-600" : "text-zinc-400")} strokeWidth={1.8} />
      {item.label}
    </Link>
  );
}

function IconButton({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <button
      title={title}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700"
    >
      {children}
    </button>
  );
}

// ── Workspace switcher (rail logo → dropdown) ────────────────────────────────

function WorkspaceSwitcher({ email, initials, who }: { email: string; initials: string; who: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="LetterStack"
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-sm font-bold text-white"
      >
        L
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
          <div className="truncate border-b border-zinc-100 px-3 py-2.5 text-xs text-zinc-400">{email}</div>
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-sm font-bold text-white">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-zinc-800">LetterStack</div>
              <div className="truncate text-xs text-zinc-400">{who}</div>
            </div>
            <Check className="h-4 w-4 shrink-0 text-indigo-600" strokeWidth={2.2} />
          </div>
          <div className="border-t border-zinc-100 p-1">
            <MenuRow icon={LogOut} label="Sign out" onClick={() => signOut({ callbackUrl: "/" })} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Account menu (top-right avatar) ──────────────────────────────────────────

function AccountMenu({ email, initials, who }: { email: string; initials: string; who: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title={who}
        className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-600 hover:bg-zinc-300"
      >
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
          <div className="border-b border-zinc-100 px-3 py-2.5">
            <div className="truncate text-sm font-medium text-zinc-800">{who}</div>
            <div className="truncate text-xs text-zinc-400">{email}</div>
          </div>
          <div className="p-1">
            <MenuRow icon={LogOut} label="Sign out" onClick={() => signOut({ callbackUrl: "/" })} />
          </div>
        </div>
      )}
    </div>
  );
}

function MenuRow({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
    >
      <Icon className="h-4 w-4 text-zinc-400" strokeWidth={1.8} /> {label}
    </button>
  );
}

// Shared outside-click handler for the dropdowns.
function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOut();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [active, ref, onOut]);
}

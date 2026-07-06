"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import {
  BarChart3Icon,
  CalendarClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  GlobeIcon,
  HomeIcon,
  LayoutTemplateIcon,
  MailCheckIcon,
  MailIcon,
  MoreHorizontalIcon,
  PenLineIcon,
  PlusIcon,
  SendIcon,
  UsersIcon,
  WorkflowIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { onOrganizationChanged } from "@/lib/dashboard-events";
import { cn } from "@/lib/utils";

type RecentCampaign = { id: string; name: string; status: string };

function statusEmoji(status: string) {
  if (status === "sent") return "✅";
  if (status === "sending") return "📤";
  if (status === "scheduled") return "⏰";
  return "📝";
}

// ─── Nav item ─────────────────────────────────────────────────────────────────

type NavItemProps = {
  href: string;
  icon: React.ElementType;
  label: string;
  active?: boolean;
  className?: string;
};

function NavItem({ href, icon: Icon, label, active, className }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0 opacity-70 group-[.active]:opacity-100" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

// ─── Section toggle ───────────────────────────────────────────────────────────

function SectionHeader({
  label,
  open,
  onToggle,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 hover:text-muted-foreground transition-colors"
    >
      {open ? (
        <ChevronDownIcon className="size-3 shrink-0" />
      ) : (
        <ChevronRightIcon className="size-3 shrink-0" />
      )}
      {label}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

// Module detection: each icon-rail module gets its own contextual sidebar.
// Rolled out module by module — routes without a module sidebar yet fall
// back to the generic workspace nav.
function isCampaignsModule(pathname: string) {
  return (
    pathname.startsWith("/dashboard/campaigns") ||
    pathname.startsWith("/dashboard/analytics")
  );
}

export function NavSidebar() {
  const pathname = usePathname();

  if (isCampaignsModule(pathname)) {
    // useSearchParams (inside) needs a Suspense boundary for prerendering.
    return (
      <Suspense fallback={<aside className="w-52 shrink-0 border-r border-border/60 bg-background" />}>
        <CampaignsSidebar />
      </Suspense>
    );
  }

  return <DefaultSidebar />;
}

// ─── Campaigns module ─────────────────────────────────────────────────────────

function useRecentCampaigns() {
  const [recent, setRecent] = useState<RecentCampaign[]>([]);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/campaigns")
        .then((r) => r.json())
        .then((data) => {
          if (!alive || !data.ok) return;
          setRecent(
            (data.campaigns ?? [])
              .slice(0, 5)
              .map((c: RecentCampaign) => ({
                id: c.id,
                name: c.name || "Untitled campaign",
                status: c.status,
              })),
          );
        })
        .catch(() => {});
    load();
    const off = onOrganizationChanged(load);
    return () => {
      alive = false;
      off();
    };
  }, []);

  return recent;
}

function RecentSection({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(true);
  const recent = useRecentCampaigns();

  return (
    <div className="mt-2 flex flex-1 flex-col overflow-hidden px-2">
      <SectionHeader label="Recent" open={open} onToggle={() => setOpen((v) => !v)} />
      {open && (
        <div className="mt-0.5 flex flex-col gap-0.5 overflow-y-auto pb-2">
          {recent.length === 0 && (
            <p className="px-2 py-1 text-xs text-muted-foreground/60">
              No campaigns yet
            </p>
          )}
          {recent.map((c) => (
            <Link
              key={c.id}
              href={`/dashboard/campaigns/${c.id}`}
              className={cn(
                "flex h-7 items-center gap-2 rounded-md px-2 text-xs transition-colors",
                pathname === `/dashboard/campaigns/${c.id}`
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/55 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <span className="text-xs leading-none">{statusEmoji(c.status)}</span>
              <span className="truncate">{c.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignsSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const onList = pathname === "/dashboard/campaigns";

  const statusViews = [
    { key: "draft", label: "Drafts", icon: PenLineIcon },
    { key: "scheduled", label: "Scheduled", icon: CalendarClockIcon },
    { key: "sent", label: "Sent", icon: MailCheckIcon },
  ] as const;

  return (
    <aside className="flex w-52 shrink-0 flex-col overflow-hidden border-r border-border/60 bg-background">
      {/* ── Module header ── */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-sidebar-border/50 px-3">
        <span className="text-sm font-semibold text-sidebar-foreground">
          Campaigns
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground hover:text-foreground"
          asChild
        >
          <Link href="/dashboard/campaigns" aria-label="New campaign">
            <PlusIcon className="size-3.5" />
          </Link>
        </Button>
      </div>

      {/* ── Quick add ── */}
      <div className="px-2 pt-2.5">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 border-dashed border-sidebar-border text-muted-foreground h-7 text-xs hover:border-border hover:text-foreground"
          asChild
        >
          <Link href="/dashboard/campaigns">
            <PlusIcon className="size-3.5 shrink-0" />
            New campaign
          </Link>
        </Button>
      </div>

      {/* ── Views ── */}
      <nav className="flex flex-col gap-0.5 px-2 pt-2 pb-1">
        <NavItem
          href="/dashboard/campaigns"
          icon={SendIcon}
          label="All campaigns"
          active={onList && !status}
        />
        {statusViews.map((view) => (
          <NavItem
            key={view.key}
            href={`/dashboard/campaigns?status=${view.key}`}
            icon={view.icon}
            label={view.label}
            active={onList && status === view.key}
          />
        ))}
        <NavItem
          href="/dashboard/analytics"
          icon={BarChart3Icon}
          label="Analytics"
          active={pathname.startsWith("/dashboard/analytics")}
        />
      </nav>

      {/* ── Divider ── */}
      <div className="mx-3 my-1 border-t border-sidebar-border/50" />

      <RecentSection pathname={pathname} />
    </aside>
  );
}

// ─── Default (generic) sidebar ────────────────────────────────────────────────

function DefaultSidebar() {
  const pathname = usePathname();
  const [workspaceOpen, setWorkspaceOpen] = useState(true);

  return (
    <aside className="flex w-52 shrink-0 flex-col overflow-hidden border-r border-border/60 bg-background">
      {/* ── Panel header ── */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-sidebar-border/50 px-3">
        <span className="text-sm font-semibold text-sidebar-foreground">
          LetterStack
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-foreground"
          >
            <MoreHorizontalIcon className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-muted-foreground hover:text-foreground"
          >
            <PlusIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Quick add ── */}
      <div className="px-2 pt-2.5">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 border-dashed border-sidebar-border text-muted-foreground h-7 text-xs hover:border-border hover:text-foreground"
          asChild
        >
          <Link href="/dashboard/campaigns">
            <PlusIcon className="size-3.5 shrink-0" />
            New campaign
          </Link>
        </Button>
      </div>

      {/* ── Primary nav ── */}
      <nav className="flex flex-col gap-0.5 px-2 pt-2 pb-1">
        <NavItem
          href="/dashboard"
          icon={HomeIcon}
          label="Overview"
          active={pathname === "/dashboard"}
        />
        <NavItem
          href="/dashboard/campaigns"
          icon={SendIcon}
          label="Campaigns"
          active={pathname.startsWith("/dashboard/campaigns")}
        />
        <NavItem
          href="/dashboard/audience"
          icon={UsersIcon}
          label="Audience"
          active={pathname.startsWith("/dashboard/audience")}
        />
        <NavItem
          href="/dashboard/templates"
          icon={LayoutTemplateIcon}
          label="Templates"
          active={pathname.startsWith("/dashboard/templates")}
        />
        <NavItem
          href="/dashboard/automations"
          icon={WorkflowIcon}
          label="Automations"
          active={pathname.startsWith("/dashboard/automations")}
        />
        <NavItem
          href="/dashboard/domains"
          icon={GlobeIcon}
          label="Domains"
          active={pathname.startsWith("/dashboard/domains")}
        />
      </nav>

      {/* ── Divider ── */}
      <div className="mx-3 my-1 border-t border-sidebar-border/50" />

      {/* ── Workspace section ── */}
      <div className="px-2">
        <SectionHeader
          label="Workspace"
          open={workspaceOpen}
          onToggle={() => setWorkspaceOpen((v) => !v)}
        />
        {workspaceOpen && (
          <div className="mt-0.5 flex flex-col gap-0.5">
            <NavItem
              href="/editor"
              icon={MailIcon}
              label="Editor"
              active={pathname.startsWith("/editor")}
            />
            <NavItem
              href="/dashboard/contacts"
              icon={UsersIcon}
              label="Contacts"
              active={pathname.startsWith("/dashboard/contacts")}
            />
          </div>
        )}
      </div>

      <RecentSection pathname={pathname} />
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import {
  BanIcon,
  BarChart3Icon,
  BookmarkIcon,
  CalendarClockIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  GlobeIcon,
  HistoryIcon,
  HomeIcon,
  LayoutTemplateIcon,
  MailCheckIcon,
  MailIcon,
  MailPlusIcon,
  MailWarningIcon,
  MoreHorizontalIcon,
  PenLineIcon,
  PlusIcon,
  SendIcon,
  SquarePenIcon,
  UploadIcon,
  UsersIcon,
  WorkflowIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { CampaignStatusIcon } from "@/components/campaign-status-icon";
import { onOrganizationChanged } from "@/lib/dashboard-events";
import { cn } from "@/lib/utils";

type RecentCampaign = { id: string; name: string; status: string };

// ─── Nav item ─────────────────────────────────────────────────────────────────

type NavItemProps = {
  href: string;
  icon: React.ElementType;
  label: string;
  active?: boolean;
  count?: number;
  className?: string;
};

function NavItem({ href, icon: Icon, label, active, count, className }: NavItemProps) {
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
      {typeof count === "number" && (
        <span className="ml-auto text-xs tabular-nums text-muted-foreground/70">
          {count}
        </span>
      )}
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
// The overview (/dashboard) keeps the generic workspace nav.
type Module =
  | "campaigns"
  | "audience"
  | "templates"
  | "automations"
  | "forms"
  | "domains";

function moduleForPath(pathname: string): Module | null {
  if (
    pathname.startsWith("/dashboard/campaigns") ||
    pathname.startsWith("/dashboard/analytics")
  ) {
    return "campaigns";
  }
  if (
    pathname.startsWith("/dashboard/audience") ||
    pathname.startsWith("/dashboard/contacts")
  ) {
    return "audience";
  }
  if (pathname.startsWith("/dashboard/templates")) return "templates";
  if (pathname.startsWith("/dashboard/automations")) return "automations";
  if (pathname.startsWith("/dashboard/forms")) return "forms";
  if (pathname.startsWith("/dashboard/domains")) return "domains";
  return null;
}

const MODULE_SIDEBARS: Record<Module, () => React.JSX.Element> = {
  campaigns: CampaignsSidebar,
  audience: AudienceSidebar,
  templates: TemplatesSidebar,
  automations: AutomationsSidebar,
  forms: FormsSidebar,
  domains: DomainsSidebar,
};

export function NavSidebar() {
  const pathname = usePathname();
  const module = moduleForPath(pathname);

  if (!module) return <DefaultSidebar />;

  const ModuleSidebar = MODULE_SIDEBARS[module];
  // useSearchParams (inside) needs a Suspense boundary for prerendering.
  return (
    <Suspense
      fallback={<aside className="w-52 shrink-0 border-r border-border/60 bg-background" />}
    >
      <ModuleSidebar />
    </Suspense>
  );
}

// ─── Shared module chrome ─────────────────────────────────────────────────────

function ModuleShell({
  title,
  plus,
  quickAdd,
  children,
}: {
  title: string;
  /** Element rendered as the header + button (Link or Button). */
  plus?: React.ReactNode;
  /** Dashed quick-add button below the header. */
  quickAdd?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <aside className="flex w-52 shrink-0 flex-col overflow-hidden border-r border-border/60 bg-background">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-sidebar-border/50 px-3">
        <span className="text-sm font-semibold text-sidebar-foreground">
          {title}
        </span>
        {plus}
      </div>
      {quickAdd && <div className="px-2 pt-2.5">{quickAdd}</div>}
      {children}
    </aside>
  );
}

const QUICK_ADD_CLASS =
  "w-full justify-start gap-2 border-dashed border-sidebar-border text-muted-foreground h-7 text-xs hover:border-border hover:text-foreground";

// ─── Campaigns module ─────────────────────────────────────────────────────────

type CampaignCounts = {
  all: number;
  draft: number;
  scheduled: number;
  sent: number;
};

function useRecentCampaigns() {
  const [recent, setRecent] = useState<RecentCampaign[]>([]);
  const [counts, setCounts] = useState<CampaignCounts | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/campaigns")
        .then((r) => r.json())
        .then((data) => {
          if (!alive || !data.ok) return;
          const campaigns: RecentCampaign[] = data.campaigns ?? [];
          setRecent(
            campaigns.slice(0, 5).map((c) => ({
              id: c.id,
              name: c.name || "Untitled campaign",
              status: c.status,
            })),
          );
          setCounts({
            all: campaigns.length,
            draft: campaigns.filter((c) => c.status === "draft").length,
            scheduled: campaigns.filter((c) => c.status === "scheduled").length,
            sent: campaigns.filter((c) => c.status === "sent").length,
          });
        })
        .catch(() => {});
    load();
    const off = onOrganizationChanged(load);
    return () => {
      alive = false;
      off();
    };
  }, []);

  return { recent, counts };
}

function RecentSection({
  pathname,
  recent,
}: {
  pathname: string;
  recent: RecentCampaign[];
}) {
  const [open, setOpen] = useState(true);

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
              <CampaignStatusIcon status={c.status} className="size-3" />
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
  const { recent, counts } = useRecentCampaigns();

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
          <Link href="/dashboard/campaigns?create=1" aria-label="New campaign">
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
          <Link href="/dashboard/campaigns?create=1">
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
          count={counts?.all}
        />
        {statusViews.map((view) => (
          <NavItem
            key={view.key}
            href={`/dashboard/campaigns?status=${view.key}`}
            icon={view.icon}
            label={view.label}
            active={onList && status === view.key}
            count={counts?.[view.key]}
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

      <RecentSection pathname={pathname} recent={recent} />
    </aside>
  );
}

// ─── Audience module ──────────────────────────────────────────────────────────

function AudienceSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const importing = searchParams.get("import") === "1";
  const onList =
    pathname === "/dashboard/audience" || pathname === "/dashboard/contacts";

  return (
    <ModuleShell
      title="Audience"
      plus={
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground hover:text-foreground"
          asChild
        >
          <Link href="/dashboard/audience?import=1" aria-label="Import contacts">
            <PlusIcon className="size-3.5" />
          </Link>
        </Button>
      }
      quickAdd={
        <Button variant="outline" size="sm" className={QUICK_ADD_CLASS} asChild>
          <Link href="/dashboard/audience?import=1">
            <UploadIcon className="size-3.5 shrink-0" />
            Import contacts
          </Link>
        </Button>
      }
    >
      <nav className="flex flex-col gap-0.5 px-2 pt-2 pb-1">
        <NavItem
          href="/dashboard/audience"
          icon={UsersIcon}
          label="All contacts"
          active={onList && !status && !importing}
        />
        <NavItem
          href="/dashboard/audience?status=subscribed"
          icon={MailCheckIcon}
          label="Subscribed"
          active={onList && status === "subscribed"}
        />
        <NavItem
          href="/dashboard/audience?status=bounced"
          icon={MailWarningIcon}
          label="Bounced"
          active={onList && status === "bounced"}
        />
        <NavItem
          href="/dashboard/audience?status=suppressed"
          icon={BanIcon}
          label="Suppressed"
          active={onList && status === "suppressed"}
        />
      </nav>
    </ModuleShell>
  );
}

// ─── Templates module ─────────────────────────────────────────────────────────

function TemplatesSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "letterstack";
  const onPage = pathname === "/dashboard/templates";

  return (
    <ModuleShell
      title="Templates"
      plus={
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground hover:text-foreground"
          asChild
        >
          <Link href="/editor" aria-label="New template">
            <PlusIcon className="size-3.5" />
          </Link>
        </Button>
      }
      quickAdd={
        <Button variant="outline" size="sm" className={QUICK_ADD_CLASS} asChild>
          <Link href="/editor">
            <SquarePenIcon className="size-3.5 shrink-0" />
            New template
          </Link>
        </Button>
      }
    >
      <nav className="flex flex-col gap-0.5 px-2 pt-2 pb-1">
        <NavItem
          href="/dashboard/templates"
          icon={LayoutTemplateIcon}
          label="Gallery"
          active={onPage && tab === "letterstack"}
        />
        <NavItem
          href="/dashboard/templates?tab=saved"
          icon={BookmarkIcon}
          label="Saved templates"
          active={onPage && tab === "saved"}
        />
        <NavItem
          href="/dashboard/templates?tab=recent"
          icon={HistoryIcon}
          label="Recently sent"
          active={onPage && tab === "recent"}
        />
        <NavItem
          href="/editor"
          icon={MailIcon}
          label="Open editor"
          active={false}
        />
      </nav>
    </ModuleShell>
  );
}

// ─── Automations module ───────────────────────────────────────────────────────

function AutomationsSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function createAutomation() {
    if (creating) return;
    setCreating(true);
    try {
      const r = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled automation" }),
      });
      const data = await r.json();
      if (data.ok) {
        router.push(`/dashboard/automations/${data.automation.id}`);
        return;
      }
    } catch {
      // stay on page
    }
    setCreating(false);
  }

  return (
    <ModuleShell
      title="Automations"
      plus={
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground hover:text-foreground"
          onClick={createAutomation}
          disabled={creating}
          aria-label="New automation"
        >
          <PlusIcon className="size-3.5" />
        </Button>
      }
      quickAdd={
        <Button
          variant="outline"
          size="sm"
          className={QUICK_ADD_CLASS}
          onClick={createAutomation}
          disabled={creating}
        >
          <PlusIcon className="size-3.5 shrink-0" />
          {creating ? "Creating…" : "New automation"}
        </Button>
      }
    >
      <nav className="flex flex-col gap-0.5 px-2 pt-2 pb-1">
        <NavItem
          href="/dashboard/automations"
          icon={WorkflowIcon}
          label="All automations"
          active={pathname === "/dashboard/automations"}
        />
      </nav>
    </ModuleShell>
  );
}

// ─── Forms module ─────────────────────────────────────────────────────────────

function FormsSidebar() {
  const pathname = usePathname();

  return (
    <ModuleShell
      title="Forms"
      plus={
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground hover:text-foreground"
          asChild
        >
          <Link href="/dashboard/forms?create=1" aria-label="New form">
            <PlusIcon className="size-3.5" />
          </Link>
        </Button>
      }
      quickAdd={
        <Button variant="outline" size="sm" className={QUICK_ADD_CLASS} asChild>
          <Link href="/dashboard/forms?create=1">
            <PlusIcon className="size-3.5 shrink-0" />
            New form
          </Link>
        </Button>
      }
    >
      <nav className="flex flex-col gap-0.5 px-2 pt-2 pb-1">
        <NavItem
          href="/dashboard/forms"
          icon={MailPlusIcon}
          label="All forms"
          active={pathname.startsWith("/dashboard/forms")}
        />
      </nav>
    </ModuleShell>
  );
}

// ─── Domains module ───────────────────────────────────────────────────────────

function DomainsSidebar() {
  const pathname = usePathname();

  return (
    <ModuleShell
      title="Domains"
      plus={
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground hover:text-foreground"
          asChild
        >
          <Link href="/dashboard/domains" aria-label="Connect domain">
            <PlusIcon className="size-3.5" />
          </Link>
        </Button>
      }
    >
      <nav className="flex flex-col gap-0.5 px-2 pt-2 pb-1">
        <NavItem
          href="/dashboard/domains"
          icon={GlobeIcon}
          label="Connected domains"
          active={pathname.startsWith("/dashboard/domains")}
        />
      </nav>
    </ModuleShell>
  );
}

// ─── Default (generic) sidebar ────────────────────────────────────────────────

function DefaultSidebar() {
  const pathname = usePathname();
  const [workspaceOpen, setWorkspaceOpen] = useState(true);
  const { recent } = useRecentCampaigns();

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
          <Link href="/dashboard/campaigns?create=1">
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
          label="Dashboard"
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
          href="/dashboard/forms"
          icon={MailPlusIcon}
          label="Forms"
          active={pathname.startsWith("/dashboard/forms")}
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

      <RecentSection pathname={pathname} recent={recent} />
    </aside>
  );
}

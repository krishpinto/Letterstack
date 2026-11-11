"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOutAndClearDrafts } from "@/lib/editor/sign-out";
import {
  ChevronDownIcon,
  LogOutIcon,
  MenuIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  UserPlusIcon,
  ZapIcon,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { dispatchOrganizationChanged } from "@/lib/dashboard-events";
import { PLAN_LIMITS, type PlanKey } from "@/lib/plans/limits";
import { type PlanNotice } from "@/lib/plans/notice";
import { CommandPalette } from "./command-palette";
import { CreateWorkspaceScreen } from "./create-workspace-screen";
import { HelpMenu, useModifierKey } from "./help-menu";
import { NotificationsMenu } from "./notifications-menu";
import { InviteMembersDialog } from "./invite-members-dialog";
import { canManageWorkspace } from "./workspace-role";

export type NavbarOrganization = {
  id: string;
  name: string;
  type: string;
  role?: string;
  memberCount?: number;
};

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}

function orgMeta(org: NavbarOrganization) {
  const role = capitalize(org.role ?? "member");
  const count = org.memberCount ?? 1;
  // The workspace type is a label for now (no plans/tiers yet) — surfacing
  // it here is what makes the create-screen choice mean something.
  const type = capitalize(org.type || "workspace");
  return `${type} • ${role} • ${count} ${count === 1 ? "member" : "members"}`;
}

type TopNavbarProps = {
  organization: NavbarOrganization;
  organizations: NavbarOrganization[];
  userName: string;
  userEmail: string;
  plan?: PlanKey;
  /** Pre-formatted expiry date, e.g. "10 October 2026". Null hides the line. */
  planUntil?: string | null;
  /** Shown under the bell. Survives the top banner being dismissed. */
  planNotice?: PlanNotice | null;
  /** Opens the phone navigation sheet. The button only shows below md. */
  onOpenMobileNav?: () => void;
};

export function TopNavbar({
  organization,
  organizations,
  userName,
  userEmail,
  plan = "free",
  planUntil = null,
  planNotice = null,
  onOpenMobileNav,
}: TopNavbarProps) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [activeOrg, setActiveOrg] = useState(organization);
  const [orgs, setOrgs] = useState(
    organizations.length > 0 ? organizations : [organization],
  );
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [orgMenuOpen, setOrgMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const modifierKey = useModifierKey();

  const orgInitial = activeOrg.name.trim().slice(0, 1).toUpperCase() || "L";
  const userInitial = userName.trim().slice(0, 1).toUpperCase() || "U";
  // Only owners and admins may invite; the invite API answers 403 to members.
  const canInvite = canManageWorkspace(activeOrg.role);

  async function selectOrganization(id: string) {
    if (id === activeOrg.id) return;
    const target = orgs.find((o) => o.id === id);
    if (!target) return;

    const previous = activeOrg;
    setActiveOrg(target);
    setSwitchingId(id);
    try {
      const r = await fetch("/api/organizations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: id }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) throw new Error();
      if (Array.isArray(data.organizations)) setOrgs(data.organizations);
      if (data.organization) setActiveOrg(data.organization);
      dispatchOrganizationChanged(data.organization?.id ?? id);
      startRefresh(() => router.refresh());
    } catch {
      setActiveOrg(previous);
    } finally {
      setSwitchingId(null);
    }
  }

  function handleWorkspaceCreated(
    created: NavbarOrganization,
    organizations?: NavbarOrganization[],
  ) {
    setOrgs((current) => organizations ?? [...current, created]);
    setActiveOrg(created);
    dispatchOrganizationChanged(created.id);
    startRefresh(() => router.refresh());
  }

  return (
    <header className="relative flex h-12 shrink-0 items-center gap-3 bg-background px-3">
      {/* Create-workspace morph origin: parked over the workspace switcher so
          the takeover expands from the left, where the action started. No
          transforms here — the screen inside positions itself with fixed.
          Deliberately no aria-hidden/pointer-events-none here: those apply
          only to the invisible trigger square (handled inside
          CreateWorkspaceScreen) — putting them on this wrapper instead
          disabled every input in the expanded takeover, since pointer-events
          is inherited by descendants regardless of their own fixed/absolute
          positioning. */}
      <span className="absolute left-4 top-5">
        <CreateWorkspaceScreen
          open={createOpen}
          onOpenChange={setCreateOpen}
          userEmail={userEmail}
          onCreated={handleWorkspaceCreated}
        />
      </span>

      <InviteMembersDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        organizationName={activeOrg.name}
      />

      {/* ── Left: phone menu button + org dropdown ── */}
      {onOpenMobileNav && (
        <Button
          variant="ghost"
          size="icon"
          className="-mr-1 size-8 rounded-lg text-muted-foreground hover:text-foreground md:hidden"
          onClick={onOpenMobileNav}
          aria-label="Open navigation"
        >
          <MenuIcon className="size-4" />
        </Button>
      )}
      <DropdownMenu open={orgMenuOpen} onOpenChange={setOrgMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2 px-2 text-sm font-medium hover:bg-muted/60 focus-visible:ring-0"
          >
            <Avatar className="size-6 rounded-lg">
              <AvatarFallback className="rounded-lg bg-primary text-[11px] font-bold text-primary-foreground">
                {orgInitial}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[120px] truncate sm:inline">
              {activeOrg.name}
            </span>
            <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72 p-1.5">
          {/* Active workspace card — mirrors the profile card in the avatar
              menu so both navbar menus share one design language. */}
          <div className="mb-1 rounded-lg border border-border/60 bg-muted/30 p-2.5">
            <div className="flex items-center gap-2.5">
              <Avatar className="size-9 rounded-lg">
                <AvatarFallback className="rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                  {orgInitial}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {activeOrg.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {orgMeta(activeOrg)}
                </span>
              </span>
            </div>
            {canInvite && (
              <div className="mt-2.5 flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 flex-1 gap-1.5 rounded-lg text-xs font-medium"
                  onClick={() => {
                    setOrgMenuOpen(false);
                    setInviteOpen(true);
                  }}
                >
                  <UserPlusIcon className="size-3.5" />
                  Invite members
                </Button>
              </div>
            )}
          </div>

          {/* Other workspaces */}
          {orgs.filter((org) => org.id !== activeOrg.id).length > 0 && (
            <>
              <p className="px-2 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Switch workspace
              </p>
              {orgs
                .filter((org) => org.id !== activeOrg.id)
                .map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    className="gap-2.5 px-2 py-1.5"
                    disabled={Boolean(switchingId)}
                    onSelect={(event) => {
                      event.preventDefault();
                      void selectOrganization(org.id);
                    }}
                  >
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-muted text-xs font-semibold text-foreground">
                        {org.name.trim().slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {org.name}
                        {switchingId === org.id ? " …" : ""}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {orgMeta(org)}
                      </span>
                    </span>
                  </DropdownMenuItem>
                ))}
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2 px-2"
            onSelect={(event) => {
              event.preventDefault();
              setOrgMenuOpen(false);
              setCreateOpen(true);
            }}
          >
            <PlusIcon className="size-4" />
            Create workspace
          </DropdownMenuItem>
          {/* A link to /login used to sit here, which navigated without
              ending the session — the user stayed signed in. */}
          <DropdownMenuItem
            variant="destructive"
            className="gap-2 px-2"
            onSelect={() => void signOutAndClearDrafts({ callbackUrl: "/login" })}
          >
            <LogOutIcon className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CommandPalette
        open={searchOpen}
        onOpenChange={setSearchOpen}
        organizations={orgs}
        activeOrganizationId={activeOrg.id}
        onSwitchOrganization={(id) => void selectOrganization(id)}
        onCreateWorkspace={() => setCreateOpen(true)}
        onInviteMembers={canInvite ? () => setInviteOpen(true) : undefined}
      />

      {/* ── Center: search — opens the command palette ── */}
      <div className="flex flex-1 justify-end sm:justify-center">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
          aria-keyshortcuts="Meta+K Control+K"
          className="hidden h-8 w-full max-w-md items-center gap-2 rounded-lg bg-muted/50 px-2.5 text-sm text-muted-foreground/70 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:flex"
        >
          <SearchIcon className="size-3.5 text-muted-foreground" />
          <span className="flex-1 text-left">Search…</span>
          <KbdGroup>
            <Kbd>{modifierKey}</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-lg text-muted-foreground hover:text-foreground sm:hidden"
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
        >
          <SearchIcon className="size-4" />
        </Button>
      </div>

      {/* ── Right: actions ── */}
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="hidden h-7 gap-1.5 rounded-lg border-border/60 px-2.5 text-xs font-medium sm:flex"
          asChild
        >
          <Link href="/dashboard/campaigns?create=1">
            <PlusIcon className="size-3" />
            New campaign
          </Link>
        </Button>

        <NotificationsMenu notice={planNotice} />

        <HelpMenu onOpenSearch={() => setSearchOpen(true)} />

        {/* User avatar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative ml-1 flex size-7 cursor-pointer items-center justify-center rounded-full outline-none ring-2 ring-transparent focus-visible:ring-ring transition-shadow hover:ring-border">
              <Avatar className="size-7">
                <AvatarFallback className="bg-primary text-[11px] font-bold text-primary-foreground">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              {/* Paid mark: a ring plus a corner pip, so it still reads on a
                  28px avatar where a text badge would be unreadable. The
                  ring sits outside the avatar so it never crops the
                  initial. Deliberately the same mark on every paid tier —
                  at this size it can only say "paid", not which one. */}
              {plan !== "free" && (
                <>
                  <span className="pointer-events-none absolute -inset-0.5 rounded-full ring-2 ring-amber-400" />
                  <span className="pointer-events-none absolute -right-1 -bottom-1 flex size-3.5 items-center justify-center rounded-full bg-amber-400 ring-2 ring-background">
                    <ZapIcon className="size-2 fill-amber-950 text-amber-950" />
                  </span>
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-1.5">
            {/* Profile card: banner, overlapping avatar, centered identity */}
            <div className="mb-1.5 overflow-hidden rounded-lg border border-border/60 bg-muted/30">
              <div className="h-10 bg-gradient-to-br from-primary/20 via-muted to-muted-foreground/15" />
              <div className="-mt-5 flex flex-col items-center gap-1 px-3 pb-3">
                <Avatar className="size-10 ring-4 ring-popover">
                  <AvatarFallback className="bg-primary text-sm font-bold text-primary-foreground">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <p className="mt-1 text-sm font-semibold leading-none">
                  {userName}
                </p>
                <p className="text-xs text-muted-foreground">{userEmail}</p>
                {/* Just the tier name — the badge reads as the plan they're
                    on, not as a countdown. How long it runs is the answer to
                    clicking it, below, rather than a label worn permanently. */}
                {plan !== "free" && (
                  <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                    <ZapIcon className="size-2.5 fill-current" />
                    {PLAN_LIMITS[plan].label}
                  </span>
                )}
                {plan !== "free" && planUntil && (
                  <Link
                    href="/dashboard/settings?section=billing"
                    className="mt-1 text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {PLAN_LIMITS[plan].label} until {planUntil}
                  </Link>
                )}
              </div>
            </div>

            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings">
                <SettingsIcon />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings?section=appearance">
                <SlidersHorizontalIcon />
                Appearance
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => void signOutAndClearDrafts({ callbackUrl: "/login" })}
            >
              <LogOutIcon />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

    </header>
  );
}

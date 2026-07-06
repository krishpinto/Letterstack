"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BellIcon,
  CheckIcon,
  ChevronDownIcon,
  HelpCircleIcon,
  PlusIcon,
  SearchIcon,
  ZapIcon,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { dispatchOrganizationChanged } from "@/lib/dashboard-events";

export type NavbarOrganization = {
  id: string;
  name: string;
  type: string;
};

type TopNavbarProps = {
  organization: NavbarOrganization;
  organizations: NavbarOrganization[];
  userName: string;
  userEmail: string;
};

export function TopNavbar({
  organization,
  organizations,
  userName,
  userEmail,
}: TopNavbarProps) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [activeOrg, setActiveOrg] = useState(organization);
  const [orgs, setOrgs] = useState(
    organizations.length > 0 ? organizations : [organization],
  );
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const orgInitial = activeOrg.name.trim().slice(0, 1).toUpperCase() || "L";
  const userInitial = userName.trim().slice(0, 1).toUpperCase() || "U";

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

  async function createOrganization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (name.length < 2) {
      setCreateError("Workspace name must be at least 2 characters.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const r = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type: "business" }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) {
        throw new Error(data?.error ?? "Could not create workspace.");
      }
      const created = data.organization as NavbarOrganization;
      setOrgs((current) =>
        Array.isArray(data.organizations) ? data.organizations : [...current, created],
      );
      setActiveOrg(created);
      dispatchOrganizationChanged(created.id);
      setCreateOpen(false);
      setNewName("");
      startRefresh(() => router.refresh());
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Could not create workspace.",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 bg-background px-3">
      {/* ── Left: org dropdown ── */}
      <DropdownMenu>
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
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
            Workspaces
          </DropdownMenuLabel>
          {orgs.map((org) => (
            <DropdownMenuItem
              key={org.id}
              className="gap-2"
              disabled={Boolean(switchingId)}
              onSelect={(event) => {
                event.preventDefault();
                void selectOrganization(org.id);
              }}
            >
              <Avatar className="size-5 rounded-md">
                <AvatarFallback className="rounded-md bg-primary text-[10px] font-bold text-primary-foreground">
                  {org.name.trim().slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate">
                {org.name}
                {switchingId === org.id ? " …" : ""}
              </span>
              {org.id === activeOrg.id && (
                <CheckIcon className="size-3.5 text-muted-foreground" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2 text-muted-foreground"
            onSelect={(event) => {
              event.preventDefault();
              setCreateOpen(true);
            }}
          >
            <PlusIcon className="size-3.5" />
            Create workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Center: search ── */}
      <div className="flex flex-1 justify-center">
        <div className="relative w-full max-w-md">
          <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search..."
            className="h-8 rounded-lg border-transparent bg-muted/50 pl-8 text-sm placeholder:text-muted-foreground/60 focus-visible:border-border focus-visible:bg-background focus-visible:ring-0"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline-flex">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* ── Right: actions ── */}
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="hidden h-7 gap-1.5 rounded-lg border-border/60 px-2.5 text-xs font-medium sm:flex"
          asChild
        >
          <Link href="/dashboard/campaigns">
            <ZapIcon className="size-3" />
            Get started
          </Link>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
        >
          <BellIcon className="size-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
        >
          <HelpCircleIcon className="size-4" />
        </Button>

        {/* User avatar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 flex size-7 cursor-pointer items-center justify-center rounded-full outline-none ring-2 ring-transparent focus-visible:ring-ring transition-shadow hover:ring-border">
              <Avatar className="size-7">
                <AvatarFallback className="bg-primary text-[11px] font-bold text-primary-foreground">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <p className="text-sm font-medium leading-none">{userName}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{userEmail}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings">Profile settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings">Billing & plans</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              asChild
            >
              <Link href="/login">Sign out</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Create workspace dialog ── */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setNewName("");
            setCreateError(null);
          }
        }}
      >
        <DialogContent>
          <form onSubmit={createOrganization} className="grid gap-5">
            <DialogHeader>
              <DialogTitle>Create workspace</DialogTitle>
              <DialogDescription>
                Add a new business workspace. It becomes your active workspace
                right away.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="new-workspace-name">
                Workspace name
              </label>
              <Input
                id="new-workspace-name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Acme Studio"
                disabled={creating}
              />
            </div>
            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create workspace"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </header>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BadgeCheckIcon,
  Building2Icon,
  CheckIcon,
  ChevronsUpDownIcon,
  GalleryVerticalEndIcon,
  GlobeIcon,
  LayoutDashboardIcon,
  LineChartIcon,
  LogOutIcon,
  MailIcon,
  PenLineIcon,
  PlusIcon,
  SendIcon,
  SettingsIcon,
  UserCircleIcon,
  UsersRoundIcon,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { dispatchOrganizationChanged } from "@/lib/dashboard-events";
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const workspaceNav = [
  {
    title: "Overview",
    href: "/dashboard",
    icon: LayoutDashboardIcon,
  },
  {
    title: "Campaigns",
    href: "/dashboard/campaigns",
    icon: SendIcon,
  },
  {
    title: "Audience",
    href: "/dashboard/audience",
    icon: UsersRoundIcon,
  },
  {
    title: "Templates",
    href: "/dashboard/templates",
    icon: PenLineIcon,
  },
  {
    title: "Analytics",
    href: "/dashboard/analytics",
    icon: LineChartIcon,
  },
  {
    title: "Editor",
    href: "/editor",
    icon: MailIcon,
  },
];

const manageNav = [
  {
    title: "Domains",
    href: "/dashboard/domains",
    icon: GlobeIcon,
  },
  {
    title: "Settings",
    href: "/dashboard",
    icon: SettingsIcon,
  },
];

type SidebarOrganization = {
  id: string;
  name: string;
  type: string;
  role?: string;
};

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  organization: SidebarOrganization;
  organizations: SidebarOrganization[];
  user: {
    name: string;
    email: string;
  };
};

function initials(name: string, fallback: string) {
  const source = name.trim() || fallback;
  const parts = source.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "LS";
}

function organizationTypeLabel(type: string) {
  return type === "personal" ? "Personal workspace" : "Business workspace";
}

function mergeOrganizations(
  organizations: SidebarOrganization[],
  organization: SidebarOrganization,
) {
  const byId = new Map<string, SidebarOrganization>();
  for (const item of organizations) byId.set(item.id, item);
  byId.set(organization.id, organization);
  return Array.from(byId.values());
}

export function AppSidebar({
  organization,
  organizations,
  user,
  ...props
}: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [, startRefreshTransition] = React.useTransition();
  const [activeOrganization, setActiveOrganization] =
    React.useState<SidebarOrganization>(organization);
  const [localOrganizations, setLocalOrganizations] = React.useState<
    SidebarOrganization[]
  >(() => mergeOrganizations(organizations, organization));
  const [organizationsOpen, setOrganizationsOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [newOrganizationName, setNewOrganizationName] = React.useState("");
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [selectionError, setSelectionError] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [switchingOrganizationId, setSwitchingOrganizationId] =
    React.useState<string | null>(null);
  const organizationType = organizationTypeLabel(activeOrganization.type);
  const visibleOrganizations = localOrganizations.length > 0
    ? localOrganizations
    : [activeOrganization];

  React.useEffect(() => {
    setActiveOrganization(organization);
    setLocalOrganizations(mergeOrganizations(organizations, organization));
  }, [organization, organizations]);

  function refreshDashboardData() {
    startRefreshTransition(() => {
      router.refresh();
    });
  }

  function resetCreateModal() {
    setNewOrganizationName("");
    setCreateError(null);
  }

  async function selectOrganization(nextOrganizationId: string) {
    if (nextOrganizationId === activeOrganization.id) {
      setOrganizationsOpen(false);
      return;
    }

    const nextOrganization = localOrganizations.find(
      (item) => item.id === nextOrganizationId,
    );
    if (!nextOrganization) return;

    const previousOrganization = activeOrganization;
    setActiveOrganization(nextOrganization);
    setOrganizationsOpen(false);
    setSwitchingOrganizationId(nextOrganizationId);
    setSelectionError(null);

    try {
      const response = await fetch("/api/organizations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: nextOrganizationId }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error ?? "Could not switch organization.");
      }

      if (Array.isArray(result.organizations)) {
        setLocalOrganizations(result.organizations);
      }
      if (result.organization) {
        setActiveOrganization(result.organization);
      }
      dispatchOrganizationChanged(result.organization?.id ?? nextOrganizationId);
      refreshDashboardData();
    } catch (error) {
      setActiveOrganization(previousOrganization);
      setSelectionError(
        error instanceof Error ? error.message : "Could not switch organization.",
      );
      setOrganizationsOpen(true);
    } finally {
      setSwitchingOrganizationId(null);
    }
  }

  async function createOrganization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newOrganizationName.trim();

    if (name.length < 2) {
      setCreateError("Organization name must be at least 2 characters.");
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type: "business" }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error ?? "Could not create organization.");
      }

      const createdOrganization = result.organization as SidebarOrganization;
      if (Array.isArray(result.organizations)) {
        setLocalOrganizations(result.organizations);
      } else {
        setLocalOrganizations((current) =>
          mergeOrganizations(current, createdOrganization),
        );
      }
      setActiveOrganization(createdOrganization);
      dispatchOrganizationChanged(createdOrganization.id);
      resetCreateModal();
      setCreateOpen(false);
      refreshDashboardData();
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Could not create organization.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <>
      <Sidebar
        variant="sidebar"
        className="border-r border-sidebar-border bg-sidebar"
        {...props}
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu
                open={organizationsOpen}
                onOpenChange={(open) => {
                  setOrganizationsOpen(open);
                  if (open) setSelectionError(null);
                }}
              >
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg">
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                      <Building2Icon />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{activeOrganization.name}</span>
                      <span className="truncate text-xs">{organizationType}</span>
                    </div>
                    <ChevronsUpDownIcon className="ml-auto" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-64"
                  align="start"
                  side="bottom"
                  sideOffset={4}
                >
                  <DropdownMenuLabel>Organizations</DropdownMenuLabel>
                  {visibleOrganizations.map((item) => {
                    const active = item.id === activeOrganization.id;
                    const switching = switchingOrganizationId === item.id;

                    return (
                      <DropdownMenuItem
                        key={item.id}
                        disabled={Boolean(switchingOrganizationId)}
                        onSelect={(event) => {
                          event.preventDefault();
                          void selectOrganization(item.id);
                        }}
                      >
                        {active ? <CheckIcon /> : <Building2Icon />}
                        <span className="grid min-w-0 flex-1 text-left leading-tight">
                          <span className="truncate">{item.name}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {switching ? "Switching..." : organizationTypeLabel(item.type)}
                          </span>
                        </span>
                      </DropdownMenuItem>
                    );
                  })}
                  {selectionError ? (
                    <div className="px-2 py-1.5 text-xs text-destructive">
                      {selectionError}
                    </div>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      setOrganizationsOpen(false);
                      resetCreateModal();
                      setCreateOpen(true);
                    }}
                  >
                    <PlusIcon />
                    New organization
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {workspaceNav.map((item) => {
                  const isActive =
                    item.href === "/dashboard"
                      ? pathname === item.href
                      : pathname.startsWith(item.href);
                  const Icon = item.icon;

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link href={item.href}>
                          <Icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Manage</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {manageNav.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/dashboard"
                      ? pathname === item.href
                      : pathname.startsWith(item.href);

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link href={item.href}>
                          <Icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg">
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg">
                        {initials(user.name, user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{user.name || "User"}</span>
                      <span className="truncate text-xs">{user.email}</span>
                    </div>
                    <ChevronsUpDownIcon className="ml-auto" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
                  side="top"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuLabel>Account</DropdownMenuLabel>
                  <DropdownMenuGroup>
                    <DropdownMenuItem>
                      <UserCircleIcon />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <BadgeCheckIcon />
                      Plan and billing
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <GalleryVerticalEndIcon />
                      Templates
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/login">
                      <LogOutIcon />
                      Log out
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateModal();
        }}
      >
        <DialogContent>
          <form onSubmit={createOrganization} className="grid gap-5">
            <DialogHeader>
              <DialogTitle>Create organization</DialogTitle>
              <DialogDescription>
                Add a new business workspace. It will be saved to the database
                with you as the owner, then selected automatically.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="organization-name">
                Organization name
              </label>
              <Input
                id="organization-name"
                value={newOrganizationName}
                onChange={(event) => setNewOrganizationName(event.target.value)}
                placeholder="Acme Studio"
                autoComplete="organization"
                disabled={isCreating}
              />
            </div>

            {createError ? (
              <p className="text-sm text-destructive">{createError}</p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create organization"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import {
  BarChart3Icon,
  BellIcon,
  BuildingIcon,
  CreditCardIcon,
  GlobeIcon,
  HomeIcon,
  KeyRoundIcon,
  LayoutTemplateIcon,
  LogOutIcon,
  MailIcon,
  MailPlusIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  PlusIcon,
  SendIcon,
  ShieldIcon,
  SquarePenIcon,
  SunIcon,
  UploadIcon,
  UserIcon,
  UserPlusIcon,
  UsersIcon,
  WorkflowIcon,
} from "lucide-react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { NavbarOrganization } from "./top-navbar";

type LinkCommand = {
  label: string;
  href: string;
  icon: React.ElementType;
  /** Extra words cmdk matches on, so "contacts" finds Audience. */
  keywords?: string[];
};

// Every page in the shell. Kept next to the icon rail's list in spirit: when
// a page is added to the rail it belongs here too.
const PAGES: LinkCommand[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: HomeIcon,
    keywords: ["home", "overview"],
  },
  {
    label: "Campaigns",
    href: "/dashboard/campaigns",
    icon: SendIcon,
    keywords: ["emails", "newsletters"],
  },
  {
    label: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3Icon,
    keywords: ["stats", "opens", "clicks"],
  },
  {
    label: "Audience",
    href: "/dashboard/audience",
    icon: UsersIcon,
    keywords: ["contacts", "subscribers", "folders", "lists"],
  },
  {
    label: "Suppressed contacts",
    href: "/dashboard/audience?status=suppressed",
    icon: UsersIcon,
    keywords: ["bounced", "unsubscribed", "blocked"],
  },
  {
    label: "Templates",
    href: "/dashboard/templates",
    icon: LayoutTemplateIcon,
    keywords: ["designs", "gallery"],
  },
  {
    label: "Automations",
    href: "/dashboard/automations",
    icon: WorkflowIcon,
    keywords: ["flows", "sequences", "welcome"],
  },
  {
    label: "Forms",
    href: "/dashboard/forms",
    icon: MailPlusIcon,
    keywords: ["signup", "subscribe", "embed"],
  },
  {
    label: "Domains",
    href: "/dashboard/domains",
    icon: GlobeIcon,
    keywords: ["dns", "dkim", "sending domain", "gmail"],
  },
];

const CREATE: LinkCommand[] = [
  {
    label: "New campaign",
    href: "/dashboard/campaigns?create=1",
    icon: PlusIcon,
    keywords: ["send", "email"],
  },
  {
    label: "New template",
    href: "/editor",
    icon: SquarePenIcon,
    keywords: ["design", "editor"],
  },
  {
    label: "New signup form",
    href: "/dashboard/forms?create=1",
    icon: MailPlusIcon,
  },
  {
    label: "Import contacts",
    href: "/dashboard/audience?import=1",
    icon: UploadIcon,
    keywords: ["csv", "excel", "upload"],
  },
  {
    label: "New folder",
    href: "/dashboard/audience?newFolder=1",
    icon: UsersIcon,
    keywords: ["list", "category"],
  },
];

// Same ids as SETTINGS_NAV in components/settings/settings-shell.tsx.
const SETTINGS: LinkCommand[] = [
  {
    label: "Account",
    href: "/dashboard/settings?section=account",
    icon: UserIcon,
    keywords: ["profile", "name", "email"],
  },
  {
    label: "Organization",
    href: "/dashboard/settings?section=organization",
    icon: BuildingIcon,
    keywords: ["workspace", "members", "team"],
  },
  {
    label: "Sending",
    href: "/dashboard/settings?section=sending",
    icon: MailIcon,
    keywords: ["from address", "sender"],
  },
  {
    label: "Notifications",
    href: "/dashboard/settings?section=notifications",
    icon: BellIcon,
  },
  {
    label: "Appearance",
    href: "/dashboard/settings?section=appearance",
    icon: PaletteIcon,
    keywords: ["theme", "dark", "light"],
  },
  {
    label: "Security",
    href: "/dashboard/settings?section=security",
    icon: ShieldIcon,
    keywords: ["password"],
  },
  {
    label: "API & Integrations",
    href: "/dashboard/settings?section=api",
    icon: KeyRoundIcon,
    keywords: ["keys", "token"],
  },
  {
    label: "Billing & Plans",
    href: "/dashboard/settings?section=billing",
    icon: CreditCardIcon,
    keywords: ["upgrade", "invoice", "plan"],
  },
];

export function CommandPalette({
  open,
  onOpenChange,
  organizations,
  activeOrganizationId,
  onSwitchOrganization,
  onCreateWorkspace,
  onInviteMembers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizations: NavbarOrganization[];
  activeOrganizationId: string;
  onSwitchOrganization: (id: string) => void;
  onCreateWorkspace: () => void;
  /** Omitted for members, who can't invite. */
  onInviteMembers?: () => void;
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [creatingAutomation, setCreatingAutomation] = useState(false);

  // ⌘K on macOS, Ctrl+K elsewhere. Toggles, so the same chord closes it.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  function run(action: () => void) {
    onOpenChange(false);
    action();
  }

  function go(href: string) {
    run(() => router.push(href));
  }

  // Automations are created server-side first so the builder has an id to
  // open — the same request the Automations sidebar makes.
  async function createAutomation() {
    if (creatingAutomation) return;
    setCreatingAutomation(true);
    try {
      const response = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled automation" }),
      });
      const data = await response.json().catch(() => null);
      onOpenChange(false);
      router.push(
        data?.ok
          ? `/dashboard/automations/${data.automation.id}`
          : "/dashboard/automations",
      );
    } finally {
      setCreatingAutomation(false);
    }
  }

  const otherOrganizations = organizations.filter(
    (org) => org.id !== activeOrganizationId,
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search LetterStack"
      description="Jump to a page, create something, or change a setting."
    >
      {/* CommandDialog renders a bare dialog; cmdk needs its own root. */}
      <Command>
        <CommandInput placeholder="Search pages, actions and settings…" />
        <CommandList>
          <CommandEmpty>Nothing matches that.</CommandEmpty>

          <CommandGroup heading="Go to">
            {PAGES.map((item) => (
              <CommandItem
                key={item.href}
                value={`go ${item.label}`}
                keywords={item.keywords}
                onSelect={() => go(item.href)}
              >
                <item.icon />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />
          <CommandGroup heading="Create">
            {CREATE.map((item) => (
              <CommandItem
                key={item.href}
                value={`create ${item.label}`}
                keywords={item.keywords}
                onSelect={() => go(item.href)}
              >
                <item.icon />
                {item.label}
              </CommandItem>
            ))}
            <CommandItem
              value="create New automation"
              keywords={["flow", "sequence"]}
              disabled={creatingAutomation}
              onSelect={() => void createAutomation()}
            >
              <WorkflowIcon />
              {creatingAutomation ? "Creating automation…" : "New automation"}
            </CommandItem>
            {onInviteMembers && (
              <CommandItem
                value="create Invite members"
                keywords={["team", "teammate", "user"]}
                onSelect={() => run(onInviteMembers)}
              >
                <UserPlusIcon />
                Invite members
              </CommandItem>
            )}
          </CommandGroup>

          <CommandSeparator />
          <CommandGroup heading="Settings">
            {SETTINGS.map((item) => (
              <CommandItem
                key={item.href}
                value={`settings ${item.label}`}
                keywords={item.keywords}
                onSelect={() => go(item.href)}
              >
                <item.icon />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />
          <CommandGroup heading="Workspace">
            {otherOrganizations.map((org) => (
              <CommandItem
                key={org.id}
                value={`switch workspace ${org.name} ${org.id}`}
                onSelect={() => run(() => onSwitchOrganization(org.id))}
              >
                <BuildingIcon />
                Switch to {org.name}
              </CommandItem>
            ))}
            <CommandItem
              value="workspace Create workspace"
              onSelect={() => run(onCreateWorkspace)}
            >
              <PlusIcon />
              Create workspace
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />
          <CommandGroup heading="Theme">
            {[
              { value: "light", label: "Light theme", icon: SunIcon },
              { value: "dark", label: "Dark theme", icon: MoonIcon },
              {
                value: "system",
                label: "Match system theme",
                icon: MonitorIcon,
              },
            ]
              .filter((option) => option.value !== theme)
              .map((option) => (
                <CommandItem
                  key={option.value}
                  value={`theme ${option.label}`}
                  keywords={["appearance", "mode"]}
                  onSelect={() => run(() => setTheme(option.value))}
                >
                  <option.icon />
                  {option.label}
                </CommandItem>
              ))}
          </CommandGroup>

          <CommandSeparator />
          <CommandGroup heading="Account">
            <CommandItem
              value="account Sign out"
              keywords={["log out", "logout"]}
              onSelect={() =>
                run(() => void signOut({ callbackUrl: "/login" }))
              }
            >
              <LogOutIcon />
              Sign out
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

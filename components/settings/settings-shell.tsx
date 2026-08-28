"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BellIcon,
  BuildingIcon,
  CreditCardIcon,
  GlobeIcon,
  KeyRoundIcon,
  MailIcon,
  PaletteIcon,
  ShieldIcon,
  UserIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { type PlanKey } from "@/lib/plans/limits";
import { AccountPanel } from "@/components/settings/account-panel";
import { OrganizationPanel } from "@/components/settings/organization-panel";
import { BillingPanel } from "@/components/settings/billing-panel";

type SettingsSection = {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
};

const SETTINGS_NAV: SettingsSection[] = [
  { id: "account", label: "Account", icon: UserIcon },
  { id: "organization", label: "Organization", icon: BuildingIcon },
  { id: "sending", label: "Sending", icon: MailIcon },
  { id: "domains", label: "Domains", icon: GlobeIcon },
  { id: "notifications", label: "Notifications", icon: BellIcon },
  { id: "appearance", label: "Appearance", icon: PaletteIcon },
  { id: "security", label: "Security", icon: ShieldIcon },
  { id: "api", label: "API & Integrations", icon: KeyRoundIcon },
  { id: "billing", label: "Billing & Plans", icon: CreditCardIcon, badge: "Beta" },
];

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

function PlaceholderPanel({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
      <div className="rounded-full bg-muted p-4">
        <SettingsIcon className="size-6 opacity-40" />
      </div>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs">This section is coming soon.</p>
    </div>
  );
}

type Profile = { id: string; name: string | null; email: string; createdAt: string };
type Organization = { id: string; name: string; type: string; role?: string; memberCount?: number };
type Member = { id: string; userId: string; role: string; joinedAt: string; name: string | null; email: string };
type PendingInvite = { id: string; email: string; role: string; createdAt: string; expiresAt: string };

export function SettingsShell({
  profile,
  organization,
  members,
  pendingInvites,
  currentUserId,
  otherWorkspaceCount,
  billing,
  isAdmin = false,
}: {
  profile: Profile;
  organization: Organization;
  members: Member[];
  pendingInvites: PendingInvite[];
  currentUserId: string;
  otherWorkspaceCount: number;
  billing: {
    sends: { used: number; limit: number };
    domains: { used: number; limit: number };
    contacts: { used: number; limit: number };
    plan?: PlanKey;
    planExpiresAt?: string | null;
    isTrial?: boolean;
    trialEnded?: boolean;
    daysLeft?: number | null;
  };
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const sectionParam = searchParams.get("section");
  const initial = SETTINGS_NAV.some((s) => s.id === sectionParam) ? sectionParam! : "account";
  const [activeSection, setActiveSection] = useState(initial);

  // Keep in sync if the URL changes from outside this component (e.g. a
  // link elsewhere deep-linking straight into a section).
  useEffect(() => {
    if (sectionParam && SETTINGS_NAV.some((s) => s.id === sectionParam)) {
      setActiveSection(sectionParam);
    }
  }, [sectionParam]);

  const active = SETTINGS_NAV.find((s) => s.id === activeSection)!;

  function selectSection(id: string) {
    setActiveSection(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex h-full">
      {/* ── Settings left nav ── */}
      <aside className="flex w-52 shrink-0 flex-col border-r border-border bg-background">
        <div className="flex h-10 shrink-0 items-center border-b border-border px-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Settings
          </span>
        </div>
        <nav className="flex flex-col gap-0.5 overflow-y-auto p-2">
          {SETTINGS_NAV.map((section) => {
            const Icon = section.icon;
            const isActive = section.id === activeSection;
            return (
              <button
                key={section.id}
                onClick={() => selectSection(section.id)}
                className={cn(
                  "flex h-8 w-full items-center gap-2 rounded-md px-2 text-xs transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                <span className="flex-1 truncate text-left">{section.label}</span>
                {section.badge && (
                  <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                    {section.badge}
                  </Badge>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ── Settings content ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex h-10 shrink-0 items-center border-b border-border px-6">
          <div className="flex items-center gap-2">
            <active.icon className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">{active.label}</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 pb-24">
          {activeSection === "account" && <AccountPanel initialProfile={profile} />}
          {activeSection === "organization" && (
            <OrganizationPanel
              initialOrganization={organization}
              initialMembers={members}
              initialPendingInvites={pendingInvites}
              currentUserId={currentUserId}
              otherWorkspaceCount={otherWorkspaceCount}
            />
          )}
          {activeSection === "billing" && (
            <BillingPanel
              sends={billing.sends}
              domains={billing.domains}
              contacts={billing.contacts}
              showCheckout={isAdmin}
              profile={{ name: profile.name, email: profile.email }}
              plan={billing.plan}
              planExpiresAt={billing.planExpiresAt}
              isTrial={billing.isTrial}
              trialEnded={billing.trialEnded}
              daysLeft={billing.daysLeft}
            />
          )}
          {!["account", "organization", "billing"].includes(activeSection) && (
            <PlaceholderPanel label={active.label} />
          )}
        </div>
      </div>
    </div>
  );
}

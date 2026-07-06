"use client";

import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

// ─── Settings nav ──────────────────────────────────────────────────────────────

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
  { id: "billing", label: "Billing & Plans", icon: CreditCardIcon, badge: "Free" },
];

// ─── Panel content ─────────────────────────────────────────────────────────────

function SettingsField({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {children}
    </div>
  );
}

function SettingsBlock({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

// ── Panel: Account ──────────────────────────────────────────────────────────────
function AccountPanel() {
  return (
    <div className="flex flex-col gap-8 max-w-lg">
      <SettingsBlock
        title="Profile"
        description="Update your name and email address."
      >
        <SettingsField label="Display name">
          <Input placeholder="Your name" defaultValue="User" className="h-8 text-sm" />
        </SettingsField>
        <SettingsField label="Email address">
          <Input placeholder="you@example.com" defaultValue="user@example.com" className="h-8 text-sm" />
        </SettingsField>
      </SettingsBlock>

      <Separator />

      <SettingsBlock
        title="Danger zone"
        description="Irreversible actions for your account."
      >
        <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Delete account</p>
            <p className="text-xs text-muted-foreground">Permanently remove your account and all data.</p>
          </div>
          <Button variant="destructive" size="xs">Delete</Button>
        </div>
      </SettingsBlock>

      <div className="flex justify-end">
        <Button size="sm">Save changes</Button>
      </div>
    </div>
  );
}

// ── Panel: Organization ─────────────────────────────────────────────────────────
function OrganizationPanel() {
  return (
    <div className="flex flex-col gap-8 max-w-lg">
      <SettingsBlock
        title="Workspace"
        description="Manage your organization details."
      >
        <SettingsField label="Organization name">
          <Input placeholder="Acme Inc." defaultValue="My Workspace" className="h-8 text-sm" />
        </SettingsField>
        <SettingsField label="Type">
          <Input placeholder="personal / business" defaultValue="personal" className="h-8 text-sm" />
        </SettingsField>
      </SettingsBlock>
      <div className="flex justify-end">
        <Button size="sm">Save changes</Button>
      </div>
    </div>
  );
}

// ── Panel: Notifications ────────────────────────────────────────────────────────
function NotificationsPanel() {
  return (
    <div className="flex flex-col gap-6 max-w-lg">
      <SettingsBlock title="Email notifications" description="Choose what you get notified about.">
        {[
          { label: "Campaign sent", description: "When a campaign finishes sending." },
          { label: "Campaign failed", description: "When a send attempt fails." },
          { label: "Bounce alerts", description: "When bounce rate exceeds threshold." },
          { label: "Complaint alerts", description: "When complaint rate exceeds threshold." },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </div>
            <Switch defaultChecked={item.label !== "Complaint alerts"} />
          </div>
        ))}
      </SettingsBlock>
    </div>
  );
}

// ── Placeholder panel ──────────────────────────────────────────────────────────
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

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

// ─── Panel map ─────────────────────────────────────────────────────────────────

function PanelContent({ id }: { id: string }) {
  switch (id) {
    case "account": return <AccountPanel />;
    case "organization": return <OrganizationPanel />;
    case "notifications": return <NotificationsPanel />;
    default: return <PlaceholderPanel label={SETTINGS_NAV.find((s) => s.id === id)?.label ?? id} />;
  }
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("account");
  const active = SETTINGS_NAV.find((s) => s.id === activeSection)!;

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
                onClick={() => setActiveSection(section.id)}
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
        {/* Section header */}
        <div className="flex h-10 shrink-0 items-center border-b border-border px-6">
          <div className="flex items-center gap-2">
            {(() => { const Icon = active.icon; return <Icon className="size-3.5 text-muted-foreground" />; })()}
            <span className="text-xs font-medium">{active.label}</span>
          </div>
        </div>

        {/* Section body */}
        <div className="flex-1 overflow-auto p-6">
          <PanelContent id={activeSection} />
        </div>
      </div>
    </div>
  );
}

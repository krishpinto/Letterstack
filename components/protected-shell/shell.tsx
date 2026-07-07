"use client";

import { type ReactNode, useState } from "react";
import { usePathname } from "next/navigation";

import { ContentHeader } from "./content-header";
import { IconRail } from "./icon-rail";
import { NavSidebar } from "./nav-sidebar";
import { TopNavbar, type NavbarOrganization } from "./top-navbar";

type ProtectedShellProps = {
  children: ReactNode;
  organization: NavbarOrganization;
  organizations: NavbarOrganization[];
  userName?: string;
  userEmail?: string;
  headerActions?: ReactNode;
};

export function ProtectedShell({
  children,
  organization,
  organizations,
  userName = "User",
  userEmail = "",
  headerActions,
}: ProtectedShellProps) {
  const [navOpen, setNavOpen] = useState(true);
  const pathname = usePathname();

  const isSettings = pathname.startsWith("/dashboard/settings");
  // The workspace dashboard is content-only: no nav sidebar, no sub-header,
  // no filter panel — just the stats page.
  const isDashboardHome = pathname === "/dashboard";
  const contentOnly = isSettings || isDashboardHome;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* ── Global top navbar — full width ── */}
      <TopNavbar
        organization={organization}
        organizations={organizations}
        userName={userName}
        userEmail={userEmail}
      />

      {/* ── Body ── */}
      <div className="flex flex-1 gap-2 overflow-hidden px-2 pb-2">

        {/* Icon rail — always visible */}
        <IconRail />

        {/* ── Main bordered container ── */}
        <div className="flex flex-1 overflow-hidden rounded-xl border border-border bg-muted/30 shadow-sm">

          {/* Left nav sidebar — hidden on content-only routes */}
          {!contentOnly && navOpen && <NavSidebar />}

          {/* ── Content column ── */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-muted/20">

            {/* Content header — hidden on content-only routes */}
            {!contentOnly && (
              <ContentHeader
                onToggleSidebar={() => setNavOpen((v) => !v)}
                sidebarOpen={navOpen}
                actions={headerActions}
              />
            )}

            {/* Page content. Settings draws its own full-bleed two-panel
                layout; every other page expects the old layout's padding. */}
            <main
              className={
                isSettings ? "flex-1 overflow-auto" : "flex-1 overflow-auto p-4 md:p-6"
              }
            >
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

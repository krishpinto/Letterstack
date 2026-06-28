"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

type DashboardOrganization = {
  id: string;
  name: string;
  type: string;
  role?: string;
};

type DashboardShellProps = {
  children: ReactNode;
  organization: DashboardOrganization;
  organizations: DashboardOrganization[];
  user: {
    name: string;
    email: string;
  };
};

const pageTitles: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/campaigns": "Campaigns",
  "/dashboard/templates": "Templates",
  "/dashboard/audience": "Audience",
  "/dashboard/contacts": "Audience",
  "/dashboard/analytics": "Analytics",
  "/dashboard/domains": "Domains",
};

function getPageTitle(pathname: string) {
  if (pathname.startsWith("/dashboard/campaigns")) return "Campaign monitor";
  if (pathname.startsWith("/dashboard/templates")) return "Templates";
  if (pathname.startsWith("/dashboard/audience")) return "Audience";
  if (pathname.startsWith("/dashboard/contacts")) return "Audience";
  if (pathname.startsWith("/dashboard/analytics")) return "Analytics";
  if (pathname.startsWith("/dashboard/domains")) return "Domains";
  return pageTitles[pathname] ?? "Dashboard";
}

export function DashboardShell({
  children,
  organization,
  organizations,
  user,
}: DashboardShellProps) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <SidebarProvider className="min-h-svh bg-background text-foreground">
      <AppSidebar
        organization={organization}
        organizations={organizations}
        user={user}
      />
      <SidebarInset className="min-w-0 border-l border-border bg-background">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-sidebar/50 px-4 backdrop-blur">
          <SidebarTrigger className="" />
          <Separator orientation="vertical" className="h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <main className="flex flex-1 flex-col gap-6 p-4 md:px-4 md:py-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
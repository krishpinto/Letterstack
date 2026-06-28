import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  getActiveOrganizationForUser,
  listOrganizationsForUser,
} from "@/db/organizations";
import { ACTIVE_ORGANIZATION_COOKIE } from "@/lib/active-organization";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const activeOrganizationId =
    cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value ?? null;

  const [organization, organizations] = await Promise.all([
    getActiveOrganizationForUser(userId, activeOrganizationId),
    listOrganizationsForUser(userId),
  ]);

  if (!organization) {
    redirect("/onboarding");
  }

  return (
    <DashboardShell
      organization={{
        id: organization.id,
        name: organization.name,
        type: organization.type,
        role: organization.role,
      }}
      organizations={organizations.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        role: item.role,
      }))}
      user={{
        name: session.user?.name ?? "User",
        email: session.user?.email ?? "",
      }}
    >
      {children}
    </DashboardShell>
  );
}
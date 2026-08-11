import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  activePlan,
  getActiveOrganizationForUser,
  listOrganizationsForUser,
  planState,
} from "@/db/organizations";
import { hasSeenPlanNotice } from "@/db/users";
import { ACTIVE_ORGANIZATION_COOKIE } from "@/lib/active-organization";
import { auth } from "@/lib/auth";
import { ProtectedShell } from "@/components/protected-shell/shell";
import { TrialAnnouncement } from "@/components/plan/trial-announcement";
import { TrialStatusBanner } from "@/components/plan/trial-status-banner";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const activeOrganizationId =
    cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value ?? null;

  const [organization, organizations, seenPlanNotice] = await Promise.all([
    getActiveOrganizationForUser(userId, activeOrganizationId),
    listOrganizationsForUser(userId),
    hasSeenPlanNotice(userId),
  ]);

  if (!organization) {
    redirect("/onboarding");
  }

  const plan = planState(organization);
  // Only announce a trial that's actually running. Someone who signs up after
  // the trial has already lapsed shouldn't be congratulated on it.
  const announceTrial = plan.isTrial && !seenPlanNotice && plan.expiresAt !== null;

  return (
    <ProtectedShell
      organization={{
        id: organization.id,
        name: organization.name,
        type: organization.type,
        role: organization.role,
        memberCount: organization.memberCount,
      }}
      organizations={organizations.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        role: item.role,
        memberCount: item.memberCount,
      }))}
      userName={session.user?.name ?? "User"}
      userEmail={session.user?.email ?? ""}
      plan={activePlan(organization)}
      planUntil={
        plan.expiresAt
          ? plan.expiresAt.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : null
      }
    >
      <TrialStatusBanner
        isTrial={plan.isTrial}
        trialEnded={plan.trialEnded}
        isExpiringSoon={plan.isExpiringSoon}
        daysLeft={plan.daysLeft}
        expiresAt={plan.expiresAt?.toISOString() ?? null}
      />
      {children}
      {announceTrial && plan.expiresAt ? (
        <TrialAnnouncement
          expiresAt={plan.expiresAt.toISOString()}
          daysLeft={plan.daysLeft ?? 0}
        />
      ) : null}
    </ProtectedShell>
  );
}
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  activePlan,
  getActiveOrganizationForUser,
  listOrganizationsForUser,
  planState,
  TRIAL_DAYS,
} from "@/db/organizations";
import { hasSeenPlanNotice } from "@/db/users";
import { ACTIVE_ORGANIZATION_COOKIE } from "@/lib/active-organization";
import { auth } from "@/lib/auth";
import {
  planNotice,
  PLAN_NOTICE_DISMISSED_COOKIE,
} from "@/lib/plans/notice";
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
  // Announced whenever the free period is live, including before the clock
  // has started — that's precisely when it's worth saying that sending is
  // what starts it. Someone whose period already lapsed isn't congratulated.
  const announceTrial = plan.isTrial && !seenPlanNotice;

  // Derived once here and handed to both surfaces, so the bar and the bell
  // can't word the same warning two different ways.
  const notice = planNotice(plan);
  // Dismissal is decided on the server so a closed bar is simply absent from
  // the HTML — no flash, no layout shift after hydration. The bell gets the
  // notice regardless: closing the bar means "read", not "resolved".
  const noticeDismissed =
    notice !== null &&
    cookieStore.get(PLAN_NOTICE_DISMISSED_COOKIE)?.value === notice.id;

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
      planNotice={notice}
    >
      <TrialStatusBanner notice={noticeDismissed ? null : notice} />
      {children}
      {announceTrial ? (
        <TrialAnnouncement
          expiresAt={plan.expiresAt?.toISOString() ?? null}
          daysLeft={plan.daysLeft}
          trialDays={TRIAL_DAYS}
        />
      ) : null}
    </ProtectedShell>
  );
}
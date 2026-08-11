import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getUserProfile } from "@/db/users";
import {
  activePlan,
  getOrganizationForUser,
  getSendUsage,
  listOrganizationMembers,
  listOrganizationsForUser,
  planState,
} from "@/db/organizations";
import { listPendingInvitesForOrganization } from "@/db/invites";
import { listSendingDomains } from "@/db/sending-domains";
import { listRecipientsForOrganization } from "@/db/recipients";
import { currentOrganizationId, currentUserId } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/admin";
import { limitsFor } from "@/lib/plans/limits";
import { SettingsShell } from "@/components/settings/settings-shell";

export default async function SettingsPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/login");

  const organizationId = await currentOrganizationId();
  if (!organizationId) redirect("/onboarding");

  const [
    profile,
    organization,
    members,
    pendingInvites,
    allOrganizations,
    sendUsage,
    domains,
    contacts,
  ] = await Promise.all([
    getUserProfile(userId),
    getOrganizationForUser(userId, organizationId),
    listOrganizationMembers(organizationId),
    listPendingInvitesForOrganization(organizationId),
    listOrganizationsForUser(userId),
    getSendUsage(organizationId),
    listSendingDomains(organizationId),
    listRecipientsForOrganization(organizationId),
  ]);

  if (!profile || !organization) redirect("/dashboard");

  const plan = planState(organization);
  const contactCount = contacts.length;

  return (
    <Suspense fallback={null}>
      <SettingsShell
        profile={{
          id: profile.id,
          name: profile.name,
          email: profile.email,
          createdAt: profile.createdAt.toISOString(),
        }}
        organization={organization}
        members={members.map((m) => ({ ...m, joinedAt: m.joinedAt.toISOString() }))}
        pendingInvites={pendingInvites.map((i) => ({
          ...i,
          createdAt: i.createdAt.toISOString(),
          expiresAt: i.expiresAt.toISOString(),
        }))}
        currentUserId={userId}
        otherWorkspaceCount={Math.max(0, allOrganizations.length - 1)}
        billing={{
          sends: sendUsage,
          domains: {
            used: domains.length,
            limit: limitsFor(activePlan(organization)).domains,
          },
          contacts: {
            used: contactCount,
            limit: limitsFor(activePlan(organization)).contacts,
          },
          plan: activePlan(organization),
          planExpiresAt: organization.planExpiresAt?.toISOString() ?? null,
          isTrial: plan.isTrial,
          trialEnded: plan.trialEnded,
          daysLeft: plan.daysLeft,
        }}
        isAdmin={isAdmin(profile.email)}
      />
    </Suspense>
  );
}

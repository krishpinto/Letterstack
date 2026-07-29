import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getUserProfile } from "@/db/users";
import {
  getOrganizationForUser,
  getSendUsage,
  listOrganizationMembers,
  listOrganizationsForUser,
} from "@/db/organizations";
import { listPendingInvitesForOrganization } from "@/db/invites";
import { listSendingDomains, SENDING_DOMAIN_LIMIT } from "@/db/sending-domains";
import { currentOrganizationId, currentUserId } from "@/lib/auth-helpers";
import { SettingsShell } from "@/components/settings/settings-shell";

export default async function SettingsPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/login");

  const organizationId = await currentOrganizationId();
  if (!organizationId) redirect("/onboarding");

  const [profile, organization, members, pendingInvites, allOrganizations, sendUsage, domains] =
    await Promise.all([
      getUserProfile(userId),
      getOrganizationForUser(userId, organizationId),
      listOrganizationMembers(organizationId),
      listPendingInvitesForOrganization(organizationId),
      listOrganizationsForUser(userId),
      getSendUsage(organizationId),
      listSendingDomains(organizationId),
    ]);

  if (!profile || !organization) redirect("/dashboard");

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
          domains: { used: domains.length, limit: SENDING_DOMAIN_LIMIT },
        }}
      />
    </Suspense>
  );
}

import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getUserProfile, hasPassword } from "@/db/users";
import {
  activePlan,
  getOrganizationForUser,
  getSenderDefaults,
  getSendUsage,
  listOrganizationMembers,
  listOrganizationsForUser,
  planState,
} from "@/db/organizations";
import { listPendingInvitesForOrganization } from "@/db/invites";
import { listMailboxesForUser } from "@/db/connected-mailboxes";
import { listSendingDomains } from "@/db/sending-domains";
import { listRecipientsForOrganization } from "@/db/recipients";
import { currentOrganizationId, currentUserId } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/admin";
import { GOOGLE_AUTH_ENABLED } from "@/lib/auth";
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
    senderDefaults,
    mailboxes,
    passwordSet,
  ] = await Promise.all([
    getUserProfile(userId),
    getOrganizationForUser(userId, organizationId),
    listOrganizationMembers(organizationId),
    listPendingInvitesForOrganization(organizationId),
    listOrganizationsForUser(userId),
    getSendUsage(organizationId),
    listSendingDomains(organizationId),
    listRecipientsForOrganization(organizationId),
    getSenderDefaults(organizationId),
    listMailboxesForUser(userId, organizationId),
    hasPassword(userId),
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
        sending={{
          defaults: senderDefaults,
          sharedFromEmail: process.env.MAIL_FROM ?? "",
          // Split here rather than in the panel so the panel never has to
          // know that "verified" is stored as a nullable timestamp.
          verifiedDomains: domains.filter((d) => d.verifiedAt).map((d) => d.domain),
          unverifiedDomains: domains.filter((d) => !d.verifiedAt).map((d) => d.domain),
          mailboxes: mailboxes.map((box) => ({
            id: box.id,
            email: box.email,
            displayName: box.displayName,
            status: box.status,
          })),
        }}
        security={{
          hasPassword: passwordSet,
          googleSignInEnabled: GOOGLE_AUTH_ENABLED,
        }}
        isAdmin={isAdmin(profile.email)}
      />
    </Suspense>
  );
}

// Releasing SES domain identities when a workspace stops owning a domain.
//
// Deleting a sending_domains row (or the workspace it hangs off) does not
// touch SES. Left alone, the identity stays verified in our account, and the
// next workspace to type that domain in would be handed a working, DKIM-signed
// sender for it. Every path that ends a workspace's ownership of a domain goes
// through here so the identity goes with it. The rules themselves live in
// lib/send/domain-ownership.ts.

import { listSendingDomainOwners, listSendingDomains, removeSendingDomain } from "@/db/sending-domains";
import { releaseDomainIdentity } from "@/lib/send/domain-identity";
import { shouldReleaseIdentity } from "@/lib/send/domain-ownership";
import { baseSendingDomain } from "@/lib/send/sender-identity";

async function releaseIfUnowned(domain: string, releasingOrganizationId: string | null) {
  const ownerOrganizationIds = await listSendingDomainOwners(domain);
  const release = shouldReleaseIdentity({
    domain,
    platformDomain: baseSendingDomain(),
    ownerOrganizationIds,
    releasingOrganizationId,
  });
  if (release) await releaseDomainIdentity(domain);
}

/**
 * Disconnect one domain from a workspace. Returns false if the workspace
 * doesn't hold it.
 *
 * SES first, then the row: if SES fails, the row survives and the user can
 * simply retry. The other order would leave a verified identity nobody owns
 * on any SES error.
 */
export async function disconnectSendingDomain(
  organizationId: string,
  domain: string,
): Promise<boolean> {
  const owners = await listSendingDomainOwners(domain);
  if (!owners.includes(organizationId)) return false;

  await releaseIfUnowned(domain, organizationId);
  await removeSendingDomain(organizationId, domain);
  return true;
}

/**
 * Release every identity a workspace holds, ahead of deleting the workspace.
 * Throws on the first SES failure so the caller can abort the delete — a
 * workspace whose rows survive can retry, an orphaned identity cannot.
 * Rows are left for the cascade to remove.
 */
export async function releaseOrganizationDomainIdentities(organizationId: string): Promise<void> {
  const rows = await listSendingDomains(organizationId);
  for (const row of rows) {
    await releaseIfUnowned(row.domain, organizationId);
  }
}

/** The domains held by these workspaces, captured before they are deleted. */
export async function sendingDomainsForOrganizations(organizationIds: string[]): Promise<string[]> {
  const lists = await Promise.all(organizationIds.map((id) => listSendingDomains(id)));
  return lists.flat().map((row) => row.domain);
}

/**
 * After a cascade has already removed the rows (account deletion), release
 * whatever identities no longer have an owner. Best-effort, one domain at a
 * time: the deletion has happened and can't be rolled back, so a failure is
 * logged with the domain name for manual cleanup rather than thrown.
 */
export async function releaseOrphanedDomainIdentities(domains: string[]): Promise<void> {
  for (const domain of domains) {
    try {
      await releaseIfUnowned(domain, null);
    } catch (err) {
      console.error(`Could not release SES identity for ${domain}; remove it by hand`, err);
    }
  }
}

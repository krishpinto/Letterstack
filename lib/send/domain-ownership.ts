// Who may use, and who may release, an SES domain identity.
//
// SES identities live in OUR AWS account, one per domain, shared by nothing
// but name. That makes them dangerous to hand out: an identity that is
// already verified signs DKIM and passes DMARC for whoever sends through it.
// If a workspace could attach a domain whose identity already existed, it
// would inherit a verified sender it never proved it controls — another
// customer's old domain, or one of the operator's own.
//
// So the rules are:
//   - A workspace may only use an identity it created, or one attached to a
//     sending_domains row it already held before this request.
//   - When the last row referencing a domain goes away, the identity goes
//     too. A later re-add then creates a fresh identity with NEW DKIM tokens,
//     which only the real owner of the DNS can publish.
//
// Kept free of AWS and database imports so the rules can be unit-tested.

/** The platform's own sending domain, or any subdomain of it. */
export function isPlatformDomain(domain: string, platformDomain: string): boolean {
  if (!platformDomain) return false;
  return domain === platformDomain || domain.endsWith(`.${platformDomain}`);
}

export type AddIdentityDecision = "use" | "refuse";

/**
 * Whether a workspace that just asked for `domain` may use the identity.
 *
 * `identityExisted` is what CreateEmailIdentity told us: false means we just
 * created it, so it is fresh and unverified. `connectedBeforeRequest` is
 * whether this workspace's sending_domains row was there before the request
 * (a re-run of verification), as opposed to inserted by it.
 */
export function decideAddIdentity(input: {
  identityExisted: boolean;
  connectedBeforeRequest: boolean;
}): AddIdentityDecision {
  if (!input.identityExisted) return "use";
  // An identity that already existed is ours to keep using only if this
  // workspace already owned the domain. Otherwise it is orphaned (left
  // behind by a disconnect or a deleted workspace) or operator-managed, and
  // adopting it would hand over a verified sender.
  return input.connectedBeforeRequest ? "use" : "refuse";
}

/**
 * Whether the SES identity for `domain` should be deleted.
 *
 * `ownerOrganizationIds` are the workspaces whose sending_domains rows
 * reference the domain right now. `releasingOrganizationId` is the workspace
 * giving the domain up, or null when the rows are already gone (cleanup after
 * a cascade delete).
 *
 * Releases only when nobody else still holds the domain, and never for a
 * domain the releasing workspace doesn't hold, so one workspace can't knock
 * another's sender offline.
 */
export function shouldReleaseIdentity(input: {
  domain: string;
  platformDomain: string;
  ownerOrganizationIds: string[];
  releasingOrganizationId: string | null;
}): boolean {
  if (isPlatformDomain(input.domain, input.platformDomain)) return false;

  const { ownerOrganizationIds: owners, releasingOrganizationId: releasing } = input;
  if (releasing !== null && !owners.includes(releasing)) return false;
  return owners.every((id) => id === releasing);
}

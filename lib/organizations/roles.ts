// Workspace roles and what each may hand out. Pure, so the rules can be
// tested without a session or a database.
//
//   owner  — can destroy or hand over the workspace
//   admin  — helps run it: sender identity, domains, API keys, invites
//   member — uses it

export type OrganizationRole = "owner" | "admin" | "member";

const RANK: Record<OrganizationRole, number> = { member: 0, admin: 1, owner: 2 };

/** Rank of a stored role string. Anything unrecognised ranks below member. */
export function roleRank(role: string | null | undefined): number {
  return role && Object.hasOwn(RANK, role) ? RANK[role as OrganizationRole] : -1;
}

/** Owner or admin: the roles allowed to change workspace-wide settings. */
export function isManagerRole(role: string | null | undefined): boolean {
  return roleRank(role) >= RANK.admin;
}

/** Roles an invite can carry. Ownership is never handed out by invite. */
const INVITABLE: OrganizationRole[] = ["member", "admin"];

export type InviteRoleDecision =
  | { ok: true; role: "member" | "admin" }
  | { ok: false; error: string };

/**
 * Whether someone with `inviterRole` may invite at `requested`.
 *
 * Only owners and admins invite at all, and nobody may grant a role above
 * their own. Without this a plain member could invite a second account of
 * their own as admin and climb into settings they were never given.
 * A missing or unknown requested role means member, as before.
 */
export function decideInviteRole(
  inviterRole: string | null | undefined,
  requested: unknown,
): InviteRoleDecision {
  if (!isManagerRole(inviterRole)) {
    return { ok: false, error: "Only owners and admins can invite people." };
  }

  const role = requested === undefined || requested === null || requested === "" ? "member" : requested;
  if (typeof role !== "string" || !INVITABLE.includes(role as OrganizationRole)) {
    return { ok: false, error: "Invite as a member or an admin." };
  }
  if (roleRank(role) > roleRank(inviterRole)) {
    return { ok: false, error: "You can't invite someone with a higher role than your own." };
  }
  return { ok: true, role: role as "member" | "admin" };
}

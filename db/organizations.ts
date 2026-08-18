import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "./client";
import { organizationMembers, organizations, users } from "./schema";
import { PLAN_LIMITS, type PlanKey } from "@/lib/plans/limits";
import { claimTrialKeys, hasClaimedTrial, trialKeysFor } from "./trial-grants";

/** How long a new workspace gets Pro for free before it has to pay. */
export const TRIAL_DAYS = 60;

// Reused SQL fragments. The send counter is windowed to the calendar month,
// and the window has to roll over inside the same statement that reserves —
// doing it as a separate read-then-write lets two concurrent workers both
// see a stale window and jointly overshoot the allowance.
const ROLLED_OVER = sql`(${organizations.emailsSentPeriodStart} IS NULL OR ${organizations.emailsSentPeriodStart} < date_trunc('month', now()))`;
const USED_THIS_MONTH = sql`(CASE WHEN ${ROLLED_OVER} THEN 0 ELSE ${organizations.emailsSentCount} END)`;
// The plan in force right now, evaluated in the database rather than read
// into JS first, so the limit can't be computed from a plan that expired
// between the read and the write.
const MONTHLY_ALLOWANCE = sql`(CASE WHEN ${organizations.plan} = 'pro' AND (${organizations.planExpiresAt} IS NULL OR ${organizations.planExpiresAt} > now()) THEN ${PLAN_LIMITS.pro.emailsPerMonth} ELSE ${PLAN_LIMITS.free.emailsPerMonth} END)`;

export type OrganizationType = "personal" | "business";

/** Thrown when the caller's user row no longer exists (e.g. a stale session). */
export class OwnerNotFoundError extends Error {
  constructor() {
    super("Owner account not found");
    this.name = "OwnerNotFoundError";
  }
}

/** Thrown when someone already owns as many workspaces as their plan allows. */
export class WorkspaceLimitError extends Error {
  constructor(
    public owned: number,
    public allowance: number,
    public plan: string,
  ) {
    super(`Already owns ${owned} of ${allowance} allowed workspaces`);
    this.name = "WorkspaceLimitError";
  }
}

export function normalizeOrganizationType(value: unknown): OrganizationType {
  return value === "personal" ? "personal" : "business";
}

// Superseded by PLAN_LIMITS — kept only so the number that was shown to beta
// users during the flat-cap period is still nameable. New code should read
// the plan's allowance via getSendUsage or limitsFor().
export const BETA_EMAIL_SEND_CAP = 5000;

/**
 * Atomically reserve `count` sends against the org's beta cap. Returns true
 * (and commits the reservation) only if the org has enough headroom left;
 * returns false — reserving nothing — if it would push the org over the cap.
 * A single guarded UPDATE, so concurrent QStash workers can't both "pass" the
 * check and jointly overshoot the limit.
 */
export async function tryReserveSendQuota(
  organizationId: string,
  count: number,
): Promise<boolean> {
  if (count <= 0) return true;
  const [row] = await db
    .update(organizations)
    .set({
      emailsSentCount: sql`${USED_THIS_MONTH} + ${count}`,
      emailsSentPeriodStart: sql`(CASE WHEN ${ROLLED_OVER} THEN date_trunc('month', now()) ELSE ${organizations.emailsSentPeriodStart} END)`,
    })
    .where(
      and(
        eq(organizations.id, organizationId),
        sql`${USED_THIS_MONTH} + ${count} <= ${MONTHLY_ALLOWANCE}`,
      ),
    )
    .returning({ emailsSentCount: organizations.emailsSentCount });
  return Boolean(row);
}

/**
 * This month's usage against the plan's allowance, for the settings meters
 * and for the message shown when a send is refused. Reports zero once the
 * month has turned even if the stored counter hasn't been rolled over yet —
 * the rollover happens on the next send, and until then the stale figure
 * would overstate usage everywhere it's displayed.
 */
export async function getSendUsage(organizationId: string) {
  const [row] = await db
    .select({
      used: sql<number>`${USED_THIS_MONTH}::int`,
      limit: sql<number>`${MONTHLY_ALLOWANCE}::int`,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return {
    used: row?.used ?? 0,
    limit: row?.limit ?? PLAN_LIMITS.free.emailsPerMonth,
  };
}

function organizationSelect() {
  return {
    id: organizations.id,
    name: organizations.name,
    type: organizations.type,
    role: organizationMembers.role,
    // Hand-qualified: an interpolated column would render unqualified and
    // silently resolve against `om` inside the subquery.
    memberCount: sql<number>`(select count(*)::int from organization_members om where om.organization_id = organizations.id)`.as(
      "member_count",
    ),
    plan: organizations.plan,
    planExpiresAt: organizations.planExpiresAt,
    planSource: organizations.planSource,
    createdAt: organizations.createdAt,
  };
}

/**
 * The plan actually in force right now. Stored `plan` alone isn't enough —
 * a paid period that has run out should read as free everywhere without
 * needing a cron job to sweep expired rows.
 */
export function activePlan(org: {
  plan?: string | null;
  planExpiresAt?: Date | string | null;
}): "free" | "pro" {
  if (org.plan !== "pro") return "free";
  if (!org.planExpiresAt) return "pro";
  const expires = new Date(org.planExpiresAt);
  return expires.getTime() > Date.now() ? "pro" : "free";
}

/** Warn this many days out, in-app, before a trial or paid period lapses. */
export const EXPIRY_WARNING_DAYS = 14;

export type PlanState = {
  plan: PlanKey;
  /** How they got here. 'trial' never paid; 'paid' settled an order. */
  source: "none" | "trial" | "paid";
  expiresAt: Date | null;
  /** Whole days remaining, rounded up. Null when nothing is counting down. */
  daysLeft: number | null;
  isTrial: boolean;
  /** Close enough to expiry that the app should say so unprompted. */
  isExpiringSoon: boolean;
  /** Had a trial, and it has run out. The moment the upgrade prompt earns its place. */
  trialEnded: boolean;
};

/**
 * Everything the UI needs to talk about the plan in one shape, so a banner,
 * a badge, and a settings panel can't each derive "days left" slightly
 * differently and disagree by a day at the boundary.
 */
export function planState(org: {
  plan?: string | null;
  planExpiresAt?: Date | string | null;
  planSource?: string | null;
}): PlanState {
  const plan = activePlan(org);
  const source = (org.planSource ?? "none") as PlanState["source"];
  const expiresAt = org.planExpiresAt ? new Date(org.planExpiresAt) : null;

  const daysLeft =
    expiresAt && plan === "pro"
      ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000))
      : null;

  return {
    plan,
    source,
    expiresAt,
    daysLeft,
    isTrial: source === "trial" && plan === "pro",
    isExpiringSoon: daysLeft !== null && daysLeft <= EXPIRY_WARNING_DAYS,
    trialEnded: source === "trial" && plan === "free",
  };
}

/**
 * Put a workspace on its free Pro trial. Only ever applies to an org that has
 * never had a plan — guarding on plan_source rather than on plan means this
 * can't shorten a paid period or silently restart a trial someone already
 * used up.
 */
export async function startTrialForOrganization(
  organizationId: string,
  days: number = TRIAL_DAYS,
) {
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const [row] = await db
    .update(organizations)
    .set({ plan: "pro", planSource: "trial", planExpiresAt: expiresAt })
    .where(
      and(eq(organizations.id, organizationId), eq(organizations.planSource, "none")),
    )
    .returning({ planExpiresAt: organizations.planExpiresAt });
  return row ?? null;
}

/**
 * Begin the free Pro countdown, measured from the org's first real send.
 *
 * A granted trial sits with a null expiry — active, but not yet counting —
 * until the workspace actually sends something. Signing up and not using the
 * product shouldn't quietly consume the free period, and someone who comes
 * back a month later should still get the full two months.
 *
 * Called on every send; the guard makes all but the first a no-op. Both
 * conditions matter: plan_source pins it to granted trials so a paid expiry
 * can never be overwritten, and the null check makes it fire exactly once.
 */
export async function startTrialClockOnFirstSend(
  organizationId: string,
  days: number = TRIAL_DAYS,
) {
  const [row] = await db
    .update(organizations)
    .set({ planExpiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000) })
    .where(
      and(
        eq(organizations.id, organizationId),
        eq(organizations.planSource, "trial"),
        isNull(organizations.planExpiresAt),
      ),
    )
    .returning({ planExpiresAt: organizations.planExpiresAt });
  return row ?? null;
}

/**
 * End a granted free period immediately, leaving the workspace on Free.
 *
 * Only ever touches a granted period — the plan_source guard means a paid
 * plan can never be cut short by this, which matters because the caller is
 * an abuse check and abuse checks get things wrong.
 */
export async function endTrialForOrganization(organizationId: string) {
  const [row] = await db
    .update(organizations)
    .set({ planExpiresAt: new Date() })
    .where(
      and(
        eq(organizations.id, organizationId),
        eq(organizations.planSource, "trial"),
      ),
    )
    .returning({ planExpiresAt: organizations.planExpiresAt });
  return row ?? null;
}

/**
 * Start or extend a paid period. Extends from whichever is later — the
 * current expiry or now — so buying again mid-period adds to the remaining
 * time instead of throwing it away. Buying during a trial therefore stacks
 * on top of the remaining free days rather than forfeiting them; paying
 * early is never punished.
 */
export async function activatePlanForOrganization(
  organizationId: string,
  plan: string,
  days: number,
) {
  const [current] = await db
    .select({ planExpiresAt: organizations.planExpiresAt, plan: organizations.plan })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  const now = Date.now();
  const currentExpiry =
    current && activePlan(current) !== "free" && current.planExpiresAt
      ? new Date(current.planExpiresAt).getTime()
      : now;
  const base = Math.max(now, currentExpiry);
  const expiresAt = new Date(base + days * 24 * 60 * 60 * 1000);

  const [row] = await db
    .update(organizations)
    // planSource flips to 'paid' here and never goes back, so a lapsed
    // subscription reads as "renew" rather than reviving the trial copy.
    .set({ plan, planExpiresAt: expiresAt, planSource: "paid" })
    .where(eq(organizations.id, organizationId))
    .returning({ plan: organizations.plan, planExpiresAt: organizations.planExpiresAt });
  return row ?? null;
}

export async function getDefaultOrganizationForUser(userId: string) {
  const [row] = await db
    .select(organizationSelect())
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizationMembers.organizationId, organizations.id),
    )
    .where(eq(organizationMembers.userId, userId))
    .orderBy(asc(organizationMembers.createdAt))
    .limit(1);

  return row ?? null;
}

export async function getOrganizationForUser(
  userId: string,
  organizationId: string,
) {
  const [row] = await db
    .select(organizationSelect())
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizationMembers.organizationId, organizations.id),
    )
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizations.id, organizationId),
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function getActiveOrganizationForUser(
  userId: string,
  organizationId?: string | null,
) {
  if (organizationId) {
    const organization = await getOrganizationForUser(userId, organizationId);
    if (organization) return organization;
  }

  return getDefaultOrganizationForUser(userId);
}

export async function listOrganizationsForUser(userId: string) {
  return db
    .select(organizationSelect())
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizationMembers.organizationId, organizations.id),
    )
    .where(eq(organizationMembers.userId, userId))
    .orderBy(asc(organizationMembers.createdAt));
}

export async function createOrganizationForUser(
  userId: string,
  input: { name: string; type: OrganizationType },
) {
  // organization_members has a foreign key to users.id. If the caller's account
  // no longer exists (a session outliving its user row), that insert fails AFTER
  // the org is created, leaving a member-less orphan. Check the owner up front so
  // we never create something we can't finish.
  const [owner] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!owner) throw new OwnerNotFoundError();

  // One free Pro period per set of people, not per workspace. A second
  // workspace — or a second account on the same company domain — starts on
  // Free rather than restarting the clock.
  const trialKeys = trialKeysFor({ userId, email: owner.email });
  const alreadyClaimed = await hasClaimedTrial(trialKeys);

  const existing = await listOrganizationsForUser(userId);

  // Workspaces are capped per person, because each one carries its own
  // allowances — ten Free workspaces would add up to more monthly sending
  // than the paid tier they'd otherwise have to buy.
  //
  // The allowance follows the best plan they hold: someone paying for Pro on
  // one workspace gets the Pro allowance across all of them. Enforced only on
  // creating a new one, so anybody already over the line keeps everything
  // they have — the same grandfathering rule as contacts.
  const bestPlan: PlanKey = existing.some((org) => activePlan(org) === "pro")
    ? "pro"
    : "free";
  const allowance = PLAN_LIMITS[bestPlan].workspaces;
  if (existing.length >= allowance) {
    throw new WorkspaceLimitError(existing.length, allowance, bestPlan);
  }

  // Duplicate names among this user's workspaces get a numeric suffix
  // ("Acme" → "Acme 2") so the switcher never shows two identical entries.
  const taken = new Set(existing.map((org) => org.name.trim().toLowerCase()));
  let name = input.name;
  if (taken.has(name.toLowerCase())) {
    let suffix = 2;
    while (taken.has(`${name} ${suffix}`.toLowerCase())) suffix += 1;
    name = `${name} ${suffix}`;
  }

  const [organization] = await db
    .insert(organizations)
    .values({
      name,
      type: input.type,
      // A first workspace opens on a free Pro period; a repeat one doesn't.
      // Set at insert rather than as a follow-up update so a workspace can
      // never exist in a state where it was never granted one.
      //
      // No expiry when granted: the countdown starts at the first send, not
      // at signup — see startTrialClockOnFirstSend. A null expiry reads as
      // "Pro, not yet counting" everywhere downstream.
      plan: alreadyClaimed ? "free" : "pro",
      planSource: alreadyClaimed ? "none" : "trial",
      planExpiresAt: null,
    })
    .returning({
      id: organizations.id,
      name: organizations.name,
      type: organizations.type,
      createdAt: organizations.createdAt,
    });

  try {
    await db.insert(organizationMembers).values({
      organizationId: organization.id,
      userId,
      role: "owner",
    });
  } catch (error) {
    // neon-http is stateless (no interactive transactions), so undo the org
    // insert by hand rather than leaving an orphan behind.
    await db.delete(organizations).where(eq(organizations.id, organization.id));
    throw error;
  }

  // Claimed only once the workspace is fully built. Recording it before the
  // membership insert would burn someone's free period on a creation that
  // then rolled back.
  if (!alreadyClaimed) {
    await claimTrialKeys(trialKeys, organization.id);
  }

  return { ...organization, role: "owner", memberCount: 1 };
}

/** Thrown when a caller without the required role tries to act on an org. */
export class NotOrganizationOwnerError extends Error {
  constructor() {
    super("Only the workspace owner can do this");
    this.name = "NotOrganizationOwnerError";
  }
}

/** The caller's role in an organization, or null if they aren't a member. */
export async function getMemberRole(userId: string, organizationId: string) {
  const [row] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId),
      ),
    )
    .limit(1);
  return row?.role ?? null;
}

/** Rename a workspace / change its type. Owner-only, enforced by caller. */
export async function updateOrganization(
  organizationId: string,
  input: { name: string; type: OrganizationType },
) {
  const [organization] = await db
    .update(organizations)
    .set({ name: input.name, type: input.type })
    .where(eq(organizations.id, organizationId))
    .returning({
      id: organizations.id,
      name: organizations.name,
      type: organizations.type,
      createdAt: organizations.createdAt,
    });
  return organization ?? null;
}

/** Every member of a workspace, newest last. */
export async function listOrganizationMembers(organizationId: string) {
  return db
    .select({
      id: organizationMembers.id,
      userId: organizationMembers.userId,
      role: organizationMembers.role,
      joinedAt: organizationMembers.createdAt,
      name: users.name,
      email: users.email,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .where(eq(organizationMembers.organizationId, organizationId))
    .orderBy(asc(organizationMembers.createdAt));
}

/** Thrown when a removal would leave a workspace without an owner. */
export class CannotRemoveSoleOwnerError extends Error {
  constructor() {
    super("The workspace needs at least one owner");
    this.name = "CannotRemoveSoleOwnerError";
  }
}

export class NotFoundInOrganizationError extends Error {
  constructor() {
    super("That member isn't part of this workspace");
    this.name = "NotFoundInOrganizationError";
  }
}

/**
 * Remove a member. Owners can remove anyone but themselves; a member can
 * remove only themselves (leaving). The sole owner can never be removed —
 * delete the workspace instead.
 */
export async function removeOrganizationMember(
  organizationId: string,
  memberId: string,
  requesterUserId: string,
  requesterRole: string,
) {
  const [target] = await db
    .select({
      id: organizationMembers.id,
      userId: organizationMembers.userId,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.id, memberId),
        eq(organizationMembers.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!target) throw new NotFoundInOrganizationError();

  const actingOnSelf = target.userId === requesterUserId;
  if (!actingOnSelf && requesterRole !== "owner") {
    throw new NotOrganizationOwnerError();
  }
  if (target.role === "owner") {
    throw new CannotRemoveSoleOwnerError();
  }

  await db.delete(organizationMembers).where(eq(organizationMembers.id, memberId));
}

/** Delete a workspace and everything scoped to it. Owner-only. */
export async function deleteOrganization(organizationId: string) {
  await db.delete(organizations).where(eq(organizations.id, organizationId));
}
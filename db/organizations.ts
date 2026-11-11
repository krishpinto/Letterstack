import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./client";
import { organizationMembers, organizations, users } from "./schema";
import { activePlanAt, type StoredPlan } from "@/lib/plans/active";
import { workspaceAllowance } from "@/lib/plans/workspaces";
import {
  PAID_PLAN_KEYS,
  PLAN_LIMITS,
  type PlanKey,
} from "@/lib/plans/limits";

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
//
// One WHEN per paid tier, generated from the same table the pricing page
// reads, so adding a tier can never leave this enforcing last month's
// allowances. Allowances are emitted as SQL literals rather than bound
// parameters: a CASE whose every branch is an untyped parameter gives
// Postgres nothing to infer the result type from and fails outright (hit
// live, 2026-08-28, as "operator does not exist: integer <= text" — this
// is that same bug, fixed here for every tier instead of just Pro). They
// are our own compile-time constants, so there is no injection surface.
const PLAN_ALLOWANCE_CASES = sql.join(
  PAID_PLAN_KEYS.map(
    (key) =>
      sql`WHEN ${organizations.plan} = ${key} THEN ${sql.raw(String(PLAN_LIMITS[key].emailsPerMonth))}`,
  ),
  sql` `,
);
// The expiry guard wraps the whole CASE, so a lapsed period on ANY paid tier
// falls back to Free — not just a lapsed Starter.
const MONTHLY_ALLOWANCE = sql`(CASE WHEN (${organizations.planExpiresAt} IS NULL OR ${organizations.planExpiresAt} > now()) THEN (CASE ${PLAN_ALLOWANCE_CASES} ELSE ${sql.raw(String(PLAN_LIMITS.free.emailsPerMonth))} END) ELSE ${sql.raw(String(PLAN_LIMITS.free.emailsPerMonth))} END)`;

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
 * Give back `count` sends reserved by tryReserveSendQuota that never reached
 * the provider: a send that lost the race to start, an address suppressed
 * between reservation and send, a message the provider refused, a batch that
 * was never queued. Never call it for a send the provider accepted — that
 * email went out and counts.
 *
 * Best-effort in the same way as releaseMailboxQuota: once the month has
 * rolled over the counter already restarted from zero, and taking the
 * release out of the new month would under-count it, so it is a no-op then.
 * The floor at zero is belt and braces against a release with no matching
 * reservation.
 */
export async function releaseSendQuota(organizationId: string, count: number): Promise<void> {
  if (count <= 0) return;
  await db
    .update(organizations)
    .set({ emailsSentCount: sql`greatest(0, ${organizations.emailsSentCount} - ${count})` })
    .where(and(eq(organizations.id, organizationId), sql`not ${ROLLED_OVER}`));
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
export function activePlan(org: StoredPlan): PlanKey {
  return activePlanAt(org, new Date());
}

/** Warn this many days out, in-app, before a trial or paid period lapses. */
export const EXPIRY_WARNING_DAYS = 14;

export type PlanState = {
  plan: PlanKey;
  /** How they got here. 'trial' never paid; 'paid' settled an order; 'granted' is an admin perk. */
  source: "none" | "trial" | "paid" | "granted";
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

  // 'granted' (an admin perk) reads exactly like a trial everywhere in the
  // UI — "this period is on us", not "renew" — so it's folded into the same
  // isTrial/trialEnded flags rather than every banner/panel needing its own
  // third branch. planSource itself still keeps them distinct in the data,
  // for the admin panel and for telling perks apart from real revenue.
  const unpaid = source === "trial" || source === "granted";

  // Any paid tier counts down, not just Starter — activePlan has already
  // resolved a lapsed period to free, so "not free" means "still running".
  const daysLeft =
    expiresAt && plan !== "free"
      ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000))
      : null;

  return {
    plan,
    source,
    expiresAt,
    daysLeft,
    isTrial: unpaid && plan !== "free",
    isExpiringSoon: daysLeft !== null && daysLeft <= EXPIRY_WARNING_DAYS,
    trialEnded: unpaid && plan === "free",
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

/** The plan columns exactly as stored, for a compare-and-set against them. */
export async function getOrganizationPlan(organizationId: string) {
  const [row] = await db
    .select({
      plan: organizations.plan,
      planExpiresAt: organizations.planExpiresAt,
      planSource: organizations.planSource,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return row ?? null;
}

type StoredPlanColumns = {
  plan: string;
  planExpiresAt: Date | null;
  planSource: string;
};

/**
 * Timestamps are bound as ISO strings and cast, the same way Drizzle writes
 * a `timestamp` column: the trailing Z is ignored, so the stored value is the
 * UTC wall clock, matching every other write to these columns.
 */
function timestampParam(value: Date | null) {
  return value ? value.toISOString() : null;
}

/**
 * The workspace still has exactly the plan columns we decided from.
 *
 * Expiry is compared at millisecond precision: Postgres keeps microseconds,
 * JS dates keep milliseconds, and a value written by hand in SQL would
 * otherwise never match what we read back.
 */
function unchangedSince(expected: StoredPlanColumns) {
  return sql`plan = ${expected.plan}
    AND plan_source = ${expected.planSource}
    AND date_trunc('milliseconds', plan_expires_at) IS NOT DISTINCT FROM ${timestampParam(expected.planExpiresAt)}::timestamp`;
}

function returnedRow(result: unknown): unknown {
  const rows =
    (result as { rows?: unknown[] }).rows ??
    (Array.isArray(result) ? result : []);
  return rows[0];
}

/**
 * Apply one payment's plan grant, exactly once.
 *
 * Replaces activatePlanForOrganization, which read the expiry, added days in
 * JS, and wrote it back. Two settlements of different orders running at once
 * could both read the same expiry and one purchase's days were lost; and
 * nothing recorded that a given payment had been applied, so the grant
 * couldn't be retried safely.
 *
 * One statement does both writes, so they commit together:
 *
 * - the workspace update is a compare-and-set on the plan columns the caller
 *   decided from (see decidePlanGrant). If anything changed them in the
 *   meantime — another payment's grant, an admin — it matches nothing, and
 *   the caller re-reads and decides again.
 * - the payment is marked granted only if the workspace update happened, and
 *   the workspace update only happens while the payment is still ungranted.
 *   A second settlement of the same payment waits on the first's row lock,
 *   then finds the expiry moved and does nothing.
 *
 * Returns false when the compare-and-set lost; the caller retries.
 */
export async function grantPlanForPayment(input: {
  paymentId: string;
  organizationId: string;
  expected: StoredPlanColumns;
  next: { plan: PlanKey; planExpiresAt: Date };
  grantedPlan: PlanKey;
  grantedDays: number;
}): Promise<boolean> {
  const result = await db.execute(sql`
    WITH org AS (
      UPDATE organizations
      -- plan_source flips to 'paid' here and never goes back, so a lapsed
      -- subscription reads as "renew" rather than reviving the trial copy.
      SET plan = ${input.next.plan},
          plan_expires_at = ${timestampParam(input.next.planExpiresAt)}::timestamp,
          plan_source = 'paid'
      WHERE id = ${input.organizationId}
        AND ${unchangedSince(input.expected)}
        AND EXISTS (
          SELECT 1 FROM payments
          WHERE id = ${input.paymentId} AND status = 'paid' AND plan_granted_at IS NULL
        )
      RETURNING id
    )
    UPDATE payments
    SET plan_granted_at = now(),
        plan_granted_plan = ${input.grantedPlan},
        plan_granted_days = ${input.grantedDays}
    FROM org
    WHERE payments.id = ${input.paymentId} AND payments.plan_granted_at IS NULL
    RETURNING payments.id
  `);
  return Boolean(returnedRow(result));
}

/**
 * Take a fully refunded payment's days back, exactly once. Same
 * compare-and-set shape as grantPlanForPayment, marking plan_revoked_at.
 * Only ever moves the expiry: the tier stays, and if the cut reaches today
 * the period simply lapses to Free the way any expired one does.
 */
export async function revokePlanForPayment(input: {
  paymentId: string;
  organizationId: string;
  expected: StoredPlanColumns;
  planExpiresAt: Date;
}): Promise<boolean> {
  const result = await db.execute(sql`
    WITH org AS (
      UPDATE organizations
      SET plan_expires_at = ${timestampParam(input.planExpiresAt)}::timestamp
      WHERE id = ${input.organizationId}
        AND ${unchangedSince(input.expected)}
        AND EXISTS (
          SELECT 1 FROM payments
          WHERE id = ${input.paymentId} AND plan_revoked_at IS NULL
        )
      RETURNING id
    )
    UPDATE payments
    SET plan_revoked_at = now()
    FROM org
    WHERE payments.id = ${input.paymentId} AND payments.plan_revoked_at IS NULL
    RETURNING payments.id
  `);
  return Boolean(returnedRow(result));
}

/**
 * Set a workspace's plan outright: the tier and the end date are both stated,
 * rather than added to whatever is already there.
 *
 * This replaced an extend-by-N-days grant, which could only ever add time and
 * so could say neither of the two things a founder actually needs: put this
 * workspace on a tier until a specific date, and take a plan away. Both go
 * through here.
 *
 * - `plan: "free"` removes the plan: the expiry is cleared and the source
 *   goes back to 'none', so the workspace reads as never having had one
 *   rather than as a lapsed trial nagging them to renew.
 * - `expiresAt: null` on a paid tier means no expiry at all. activePlan()
 *   and the SQL allowance both treat a null expiry as "still running", so
 *   this is a permanent grant, not an instantly-lapsed one.
 *
 * Everything set here is recorded as 'granted', never 'paid' — a founder
 * handing out a tier must not look like revenue in the source column.
 */
export async function setAdminPlan(
  organizationId: string,
  plan: PlanKey,
  expiresAt: Date | null,
) {
  const isFree = plan === "free";
  const [row] = await db
    .update(organizations)
    .set({
      plan,
      planExpiresAt: isFree ? null : expiresAt,
      planSource: isFree ? "none" : "granted",
    })
    .where(eq(organizations.id, organizationId))
    .returning({
      plan: organizations.plan,
      planExpiresAt: organizations.planExpiresAt,
      planSource: organizations.planSource,
    });
  return row ?? null;
}

/**
 * Every organization with its plan state and owner, for the admin
 * subscriptions panel. Two queries merged in JS rather than one join with
 * GROUP BY — same shape as listSenderStats/listUsersForAdmin — since the
 * owner lookup is a small, separate fan-out, not a per-row aggregate.
 */
export async function listOrganizationsForAdmin() {
  const orgs = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      type: organizations.type,
      plan: organizations.plan,
      planExpiresAt: organizations.planExpiresAt,
      planSource: organizations.planSource,
      createdAt: organizations.createdAt,
      memberCount: sql<number>`(select count(*)::int from organization_members om where om.organization_id = organizations.id)`,
    })
    .from(organizations)
    .orderBy(desc(organizations.createdAt));

  if (orgs.length === 0) return [];

  const owners = await db
    .select({
      organizationId: organizationMembers.organizationId,
      name: users.name,
      email: users.email,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .where(
      and(
        inArray(
          organizationMembers.organizationId,
          orgs.map((org) => org.id),
        ),
        eq(organizationMembers.role, "owner"),
      ),
    );

  const ownerByOrg = new Map(owners.map((owner) => [owner.organizationId, owner]));

  return orgs.map((org) => {
    const owner = ownerByOrg.get(org.id);
    const state = planState(org);
    return {
      id: org.id,
      name: org.name,
      type: org.type,
      ownerName: owner?.name ?? null,
      ownerEmail: owner?.email ?? null,
      memberCount: Number(org.memberCount),
      plan: state.plan,
      planSource: state.source,
      planExpiresAt: state.expiresAt,
      daysLeft: state.daysLeft,
      createdAt: org.createdAt,
    };
  });
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

  const existing = await listOrganizationsForUser(userId);

  // Workspaces are capped per person, because each one carries its own
  // allowances — ten Free workspaces would add up to more monthly sending
  // than the paid tier they'd otherwise have to buy.
  //
  // Only workspaces they own count, and the allowance follows the best plan
  // among those: someone paying for Starter on one workspace gets the
  // Starter allowance across all they own, but being invited into somebody
  // else's paid workspace lends them nothing. Enforced only on creating a
  // new one, so anybody already over the line keeps everything they have —
  // the same grandfathering rule as contacts.
  const allowance = workspaceAllowance(existing, new Date());
  if (!allowance.ok) {
    throw new WorkspaceLimitError(
      allowance.owned,
      allowance.allowance,
      allowance.plan,
    );
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
      // Every new workspace starts on Free. Pro is only ever reached by
      // paying for it (lib/payments/settle.ts) or by an explicit admin grant
      // from the subscriptions panel — never handed out at signup.
      plan: "free",
      planSource: "none",
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

  // Returned so the caller can also revoke any Gmail mailbox this person
  // connected to this org — a live credential has no business staying
  // usable for a workspace they're no longer part of. Deliberately not done
  // here: revoking with Google needs lib/send/gmail-auth.ts, which pulls in
  // googleapis (Node-only), and this module is imported transitively by
  // proxy.ts (edge runtime) via lib/auth-helpers.ts — keep that path clean.
  return { removedUserId: target.userId };
}

/** Delete a workspace and everything scoped to it. Owner-only. */
export async function deleteOrganization(organizationId: string) {
  await db.delete(organizations).where(eq(organizations.id, organizationId));
}
export type SenderDefaults = {
  defaultFromName: string | null;
  defaultReplyTo: string | null;
};

/**
 * The workspace's sender defaults, read on their own rather than added to
 * organizationSelect(). That helper feeds session resolution and the
 * workspace switcher, which run on nearly every request and have no use for
 * these two columns.
 */
export async function getSenderDefaults(
  organizationId: string,
): Promise<SenderDefaults> {
  const [row] = await db
    .select({
      defaultFromName: organizations.defaultFromName,
      defaultReplyTo: organizations.defaultReplyTo,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  return {
    defaultFromName: row?.defaultFromName ?? null,
    defaultReplyTo: row?.defaultReplyTo ?? null,
  };
}

/**
 * Set the workspace's sender defaults. Empty strings are stored as NULL, so
 * "cleared" and "never set" are the same state — there is no third meaning
 * for an empty From name, and collapsing them keeps the fallback in
 * app/api/campaigns/route.ts a single null check.
 */
export async function updateSenderDefaults(
  organizationId: string,
  input: SenderDefaults,
): Promise<SenderDefaults> {
  const [row] = await db
    .update(organizations)
    .set({
      defaultFromName: input.defaultFromName?.trim() || null,
      defaultReplyTo: input.defaultReplyTo?.trim().toLowerCase() || null,
    })
    .where(eq(organizations.id, organizationId))
    .returning({
      defaultFromName: organizations.defaultFromName,
      defaultReplyTo: organizations.defaultReplyTo,
    });

  return {
    defaultFromName: row?.defaultFromName ?? null,
    defaultReplyTo: row?.defaultReplyTo ?? null,
  };
}

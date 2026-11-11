// What a purchase, or a refund, does to a workspace's paid period.
//
// Pure decisions only: no database, no clock. The settlement path reads the
// workspace, asks this module what the period should become, and writes the
// answer with a compare-and-set (see grantPlanForPayment in
// db/organizations.ts). The checkout quote asks the same question before
// anyone pays, so what the billing panel promises is what settlement does.
//
// The rules:
//
// - Nothing running (Free, or a lapsed period): the tier bought starts now.
// - Same tier: extends from the current expiry, so renewing early never
//   loses the days already paid for. Trial days stack the same way.
// - Upgrade: the new tier starts now for the period bought. The unused part
//   of a *paid* lower-tier period is not thrown away: its value converts to
//   extra days of the new tier (remaining days × old daily rate ÷ new daily
//   rate). Trial and admin-granted time was never paid for, so it has no
//   value to convert and simply ends.
// - Downgrade while a higher tier runs: refused at checkout (see
//   quoteCheckout). If one reaches settlement anyway — an order opened on
//   Starter, then an upgrade to Growth settled before it — the money is never
//   stranded: its value converts to days of the tier already running.
//
// The old behaviour extended from the current expiry whatever the tier, so
// Starter yearly then Growth monthly gave ~395 days of Growth for the price
// of 30, and a cheap Starter month bought during Growth turned the remaining
// Growth time into Starter.

import { activePlanAt } from "@/lib/plans/active";
import { PLAN_LIMITS, planRank, type PlanKey } from "@/lib/plans/limits";

export const DAY_MS = 86_400_000;

/** A workspace's plan columns, as stored. */
export type StoredPeriod = {
  plan: string | null;
  planExpiresAt: Date | null;
  planSource: string | null;
};

export type Purchase = {
  plan: PlanKey;
  days: number;
  /** What was charged, in paise. */
  amountPaise: number;
};

export type GrantDecision =
  | {
      kind: "start" | "extend" | "upgrade" | "downgrade-credit";
      /** The tier and expiry the workspace should end up on. */
      plan: PlanKey;
      expiresAt: Date;
      /**
       * Days this payment itself bought, on `plan`. A full refund takes back
       * exactly these — not the converted credit, which was paid for by an
       * earlier payment.
       */
      grantedDays: number;
      /** Extra days converted from the unused part of the previous period. */
      creditDays: number;
    }
  | {
      /**
       * The workspace already holds this tier (or a higher one) with no end
       * date — an admin grant. Nothing to extend; settlement records the
       * payment and flags it for a manual refund.
       */
      kind: "no-change";
      reason: string;
    };

type Current = {
  plan: PlanKey;
  source: string;
  expiresAt: Date | null;
  /** Milliseconds of the running period left. Zero when nothing is counting. */
  remainingMs: number;
  /** Running, with no end date. */
  permanent: boolean;
};

function current(stored: StoredPeriod, now: Date): Current {
  const plan = activePlanAt(stored, now);
  const source = stored.planSource ?? "none";
  const expiresAt = stored.planExpiresAt ? new Date(stored.planExpiresAt) : null;
  // A trial with no expiry hasn't started counting (the clock starts on the
  // first send), so there is nothing to extend from and nothing permanent
  // about it. Any other running tier with no expiry is an open-ended grant.
  const permanent = plan !== "free" && expiresAt === null && source !== "trial";
  const remainingMs =
    plan !== "free" && expiresAt
      ? Math.max(0, expiresAt.getTime() - now.getTime())
      : 0;
  return { plan, source, expiresAt, remainingMs, permanent };
}

/** List price per day, in paise, from the monthly price. Null when quoted per deal. */
export function listDailyRatePaise(plan: PlanKey): number | null {
  const monthly = PLAN_LIMITS[plan].monthlyPrice;
  if (!monthly) return null;
  return (monthly * 100) / 30;
}

export function decidePlanGrant(input: {
  current: StoredPeriod;
  purchase: Purchase;
  /**
   * Paise per day of the most recent payment that bought the tier now
   * running. Ignored unless that period was paid for — trial and granted
   * time has no value to convert.
   */
  currentDailyRatePaise: number | null;
  now: Date;
}): GrantDecision {
  const { purchase, now } = input;
  const cur = current(input.current, now);
  const purchasedMs = purchase.days * DAY_MS;
  const nowMs = now.getTime();

  if (cur.plan === "free") {
    return {
      kind: "start",
      plan: purchase.plan,
      expiresAt: new Date(nowMs + purchasedMs),
      grantedDays: purchase.days,
      creditDays: 0,
    };
  }

  const curRank = planRank(cur.plan);
  const newRank = planRank(purchase.plan);

  if (newRank === curRank) {
    if (cur.permanent) {
      return {
        kind: "no-change",
        reason: `already on ${PLAN_LIMITS[cur.plan].label} with no end date`,
      };
    }
    const base = Math.max(nowMs, cur.expiresAt?.getTime() ?? nowMs);
    return {
      kind: "extend",
      plan: purchase.plan,
      expiresAt: new Date(base + purchasedMs),
      grantedDays: purchase.days,
      creditDays: 0,
    };
  }

  if (newRank > curRank) {
    const oldRate =
      cur.source === "paid" ? input.currentDailyRatePaise : null;
    const newRate = purchase.days > 0 ? purchase.amountPaise / purchase.days : 0;
    // Whole days, rounded down: the conversion never hands out more value
    // than was left, and the most it can cost the customer is under a day.
    const creditDays =
      oldRate && oldRate > 0 && newRate > 0 && cur.remainingMs > 0
        ? Math.floor(((cur.remainingMs / DAY_MS) * oldRate) / newRate)
        : 0;
    return {
      kind: "upgrade",
      plan: purchase.plan,
      expiresAt: new Date(nowMs + (purchase.days + creditDays) * DAY_MS),
      grantedDays: purchase.days,
      creditDays,
    };
  }

  // Downgrade that got past checkout. Keep the higher tier running and add
  // the purchase's value to it, at the rate that tier was bought at.
  if (cur.permanent) {
    return {
      kind: "no-change",
      reason: `already on ${PLAN_LIMITS[cur.plan].label} with no end date`,
    };
  }
  const rate =
    (cur.source === "paid" ? input.currentDailyRatePaise : null) ??
    listDailyRatePaise(cur.plan);
  // No rate to convert at (a quoted tier granted by an admin): give the days
  // bought rather than nothing. Customer-favourable, and vanishingly rare.
  const convertedDays =
    rate && rate > 0 ? Math.floor(purchase.amountPaise / rate) : purchase.days;
  const base = Math.max(nowMs, cur.expiresAt?.getTime() ?? nowMs);
  return {
    kind: "downgrade-credit",
    plan: cur.plan,
    expiresAt: new Date(base + convertedDays * DAY_MS),
    grantedDays: convertedDays,
    creditDays: 0,
  };
}

/** "12 Jan 2027", in India time — the only time zone our customers bill in. */
function formatDay(date: Date) {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export type CheckoutQuote =
  | {
      allowed: true;
      kind: "start" | "extend" | "upgrade";
      plan: PlanKey;
      expiresAt: Date;
      creditDays: number;
      /** One line for the billing panel, said before anyone pays. */
      summary: string;
    }
  | { allowed: false; message: string };

/**
 * What buying `purchase` would do, or why it can't be bought right now.
 * Called by the billing panel to show the outcome before paying, and by
 * create-order to refuse a purchase settlement shouldn't have to absorb.
 */
export function quoteCheckout(input: {
  current: StoredPeriod;
  purchase: Purchase;
  currentDailyRatePaise: number | null;
  now: Date;
}): CheckoutQuote {
  const decision = decidePlanGrant(input);
  const label = PLAN_LIMITS[input.purchase.plan].label;

  if (decision.kind === "no-change") {
    return {
      allowed: false,
      message: `This workspace is ${decision.reason}, so there is nothing to renew. Contact us if you want to change it.`,
    };
  }

  if (decision.kind === "downgrade-credit") {
    const cur = current(input.current, input.now);
    const curLabel = PLAN_LIMITS[cur.plan].label;
    const until = cur.expiresAt ? ` until ${formatDay(cur.expiresAt)}` : "";
    return {
      allowed: false,
      message: `You're on ${curLabel}${until}. You can move to ${label} once that period ends.`,
    };
  }

  const until = formatDay(decision.expiresAt);
  let summary: string;
  if (decision.kind === "extend") {
    summary = `${label} until ${until}, added to the time you have left.`;
  } else if (decision.kind === "upgrade" && decision.creditDays > 0) {
    const from = PLAN_LIMITS[activePlanAt(input.current, input.now)].label;
    summary = `${label} from today until ${until}, including ${decision.creditDays} extra day${decision.creditDays === 1 ? "" : "s"} converted from your unused ${from} time.`;
  } else if (decision.kind === "upgrade") {
    const from = PLAN_LIMITS[activePlanAt(input.current, input.now)].label;
    summary = `${label} from today until ${until}. Your current ${from} period ends when this starts.`;
  } else {
    summary = `${label} from today until ${until}.`;
  }

  return {
    allowed: true,
    kind: decision.kind,
    plan: decision.plan,
    expiresAt: decision.expiresAt,
    creditDays: decision.creditDays,
    summary,
  };
}

export type RevocationDecision =
  | { kind: "revoke"; expiresAt: Date }
  /** Nothing left to take back: the period already ran out, or granted nothing. */
  | { kind: "nothing" }
  /** The workspace has moved on since; a person has to decide. */
  | { kind: "review"; reason: string };

/**
 * What a full refund of one payment does to the period.
 *
 * Takes back only the days that payment bought, from the end of the current
 * period — never another payment's time. When the workspace is no longer on
 * the tier the payment landed on (it upgraded since, or an admin changed
 * it), subtracting days would take time from a period this payment didn't
 * buy, so that case goes to a person instead.
 */
export function decidePlanRevocation(input: {
  current: StoredPeriod;
  grantedPlan: string | null;
  grantedDays: number;
  now: Date;
}): RevocationDecision {
  const { grantedPlan, grantedDays, now } = input;
  if (!grantedPlan || grantedDays <= 0) return { kind: "nothing" };

  const cur = current(input.current, now);
  if (cur.plan === "free") return { kind: "nothing" };
  if (cur.plan !== grantedPlan || cur.source !== "paid") {
    return {
      kind: "review",
      reason: `workspace is on ${cur.plan} (${cur.source}), the refunded payment granted ${grantedPlan}`,
    };
  }
  if (!cur.expiresAt) {
    return { kind: "review", reason: "paid period has no end date" };
  }

  const cut = cur.expiresAt.getTime() - grantedDays * DAY_MS;
  return { kind: "revoke", expiresAt: new Date(Math.max(cut, now.getTime())) };
}

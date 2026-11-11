import { describe, expect, it } from "vitest";

import {
  DAY_MS,
  decidePlanGrant,
  decidePlanRevocation,
  quoteCheckout,
  type StoredPeriod,
} from "./plan-period";

const NOW = new Date("2026-11-11T06:00:00.000Z");
const inDays = (days: number) => new Date(NOW.getTime() + days * DAY_MS);

// Catalog figures, in paise: what each purchase actually charges.
const STARTER_MONTHLY = { plan: "pro" as const, days: 30, amountPaise: 100_000 };
const STARTER_YEARLY = { plan: "pro" as const, days: 365, amountPaise: 1_000_000 };
const GROWTH_MONTHLY = { plan: "growth" as const, days: 30, amountPaise: 250_000 };
const GROWTH_YEARLY = { plan: "growth" as const, days: 365, amountPaise: 2_500_000 };

const STARTER_YEARLY_RATE = 1_000_000 / 365;
const GROWTH_MONTHLY_RATE = 250_000 / 30;

const free: StoredPeriod = { plan: "free", planExpiresAt: null, planSource: "none" };
const paid = (plan: string, expiresInDays: number): StoredPeriod => ({
  plan,
  planExpiresAt: inDays(expiresInDays),
  planSource: "paid",
});

describe("decidePlanGrant", () => {
  it("starts the bought tier now when nothing is running", () => {
    const d = decidePlanGrant({ current: free, purchase: STARTER_MONTHLY, currentDailyRatePaise: null, now: NOW });
    expect(d).toMatchObject({ kind: "start", plan: "pro", grantedDays: 30, creditDays: 0 });
    if (d.kind !== "no-change") expect(d.expiresAt).toEqual(inDays(30));
  });

  it("treats a lapsed paid period as nothing running", () => {
    const d = decidePlanGrant({ current: paid("growth", -5), purchase: STARTER_MONTHLY, currentDailyRatePaise: GROWTH_MONTHLY_RATE, now: NOW });
    expect(d).toMatchObject({ kind: "start", plan: "pro" });
    if (d.kind !== "no-change") expect(d.expiresAt).toEqual(inDays(30));
  });

  it("extends the same tier from the current expiry, not from today", () => {
    const d = decidePlanGrant({ current: paid("pro", 10), purchase: STARTER_MONTHLY, currentDailyRatePaise: STARTER_YEARLY_RATE, now: NOW });
    expect(d).toMatchObject({ kind: "extend", plan: "pro", grantedDays: 30 });
    if (d.kind !== "no-change") expect(d.expiresAt).toEqual(inDays(40));
  });

  it("stacks a paid period on top of remaining trial days", () => {
    const trial = { plan: "pro", planExpiresAt: inDays(20), planSource: "trial" };
    const d = decidePlanGrant({ current: trial, purchase: STARTER_MONTHLY, currentDailyRatePaise: null, now: NOW });
    if (d.kind === "no-change") throw new Error("expected a grant");
    expect(d.expiresAt).toEqual(inDays(50));
  });

  it("starts the paid period now for a trial whose clock never started", () => {
    const trial = { plan: "pro", planExpiresAt: null, planSource: "trial" };
    const d = decidePlanGrant({ current: trial, purchase: STARTER_MONTHLY, currentDailyRatePaise: null, now: NOW });
    expect(d).toMatchObject({ kind: "extend" });
    if (d.kind !== "no-change") expect(d.expiresAt).toEqual(inDays(30));
  });

  it("starts an upgrade now and prorates the unused paid time — Starter yearly then Growth monthly", () => {
    // 300 days of Starter left, bought at ₹10,000/365 days, become Growth
    // days at the Growth monthly rate: 300 × 27.40 / 83.33 = 98.6 → 98.
    const d = decidePlanGrant({ current: paid("pro", 300), purchase: GROWTH_MONTHLY, currentDailyRatePaise: STARTER_YEARLY_RATE, now: NOW });
    expect(d).toMatchObject({ kind: "upgrade", plan: "growth", grantedDays: 30, creditDays: 98 });
    if (d.kind !== "no-change") expect(d.expiresAt).toEqual(inDays(128));
    // The bug this replaces: extending from the Starter expiry gave 330 days of Growth.
  });

  it("never credits more value than was left", () => {
    const d = decidePlanGrant({ current: paid("pro", 300), purchase: GROWTH_YEARLY, currentDailyRatePaise: STARTER_YEARLY_RATE, now: NOW });
    if (d.kind !== "upgrade") throw new Error("expected an upgrade");
    const creditValue = d.creditDays * (2_500_000 / 365);
    const leftValue = 300 * STARTER_YEARLY_RATE;
    expect(creditValue).toBeLessThanOrEqual(leftValue);
    expect(leftValue - creditValue).toBeLessThan(2_500_000 / 365);
  });

  it("gives no credit for trial or admin-granted time on upgrade", () => {
    for (const planSource of ["trial", "granted"]) {
      const d = decidePlanGrant({
        current: { plan: "pro", planExpiresAt: inDays(50), planSource },
        purchase: GROWTH_MONTHLY,
        currentDailyRatePaise: STARTER_YEARLY_RATE,
        now: NOW,
      });
      expect(d).toMatchObject({ kind: "upgrade", creditDays: 0 });
      if (d.kind !== "no-change") expect(d.expiresAt).toEqual(inDays(30));
    }
  });

  it("gives no credit when no paid rate is known", () => {
    const d = decidePlanGrant({ current: paid("pro", 100), purchase: GROWTH_MONTHLY, currentDailyRatePaise: null, now: NOW });
    expect(d).toMatchObject({ kind: "upgrade", creditDays: 0 });
  });

  it("upgrades over an open-ended lower grant without crediting it", () => {
    const d = decidePlanGrant({
      current: { plan: "pro", planExpiresAt: null, planSource: "granted" },
      purchase: GROWTH_MONTHLY,
      currentDailyRatePaise: null,
      now: NOW,
    });
    expect(d).toMatchObject({ kind: "upgrade", plan: "growth", creditDays: 0 });
  });

  it("keeps the higher tier and converts a downgrade's value into days of it", () => {
    // A Starter month (₹1,000) bought while Growth monthly runs: ₹1,000 at
    // ₹83.33/day is 12 days of Growth — never Growth turned into Starter.
    const d = decidePlanGrant({ current: paid("growth", 20), purchase: STARTER_MONTHLY, currentDailyRatePaise: GROWTH_MONTHLY_RATE, now: NOW });
    expect(d).toMatchObject({ kind: "downgrade-credit", plan: "growth", grantedDays: 12 });
    if (d.kind !== "no-change") expect(d.expiresAt).toEqual(inDays(32));
  });

  it("converts a downgrade at the list rate when the higher tier wasn't paid for", () => {
    const d = decidePlanGrant({
      current: { plan: "growth", planExpiresAt: inDays(20), planSource: "trial" },
      purchase: STARTER_MONTHLY,
      currentDailyRatePaise: null,
      now: NOW,
    });
    expect(d).toMatchObject({ kind: "downgrade-credit", plan: "growth", grantedDays: 12 });
  });

  it("changes nothing on an open-ended grant of the same or a higher tier", () => {
    const grant = { plan: "growth", planExpiresAt: null, planSource: "granted" };
    expect(decidePlanGrant({ current: grant, purchase: GROWTH_MONTHLY, currentDailyRatePaise: null, now: NOW }).kind).toBe("no-change");
    expect(decidePlanGrant({ current: grant, purchase: STARTER_YEARLY, currentDailyRatePaise: null, now: NOW }).kind).toBe("no-change");
  });
});

describe("quoteCheckout", () => {
  it("refuses a downgrade while a higher tier runs, and says when it can happen", () => {
    const q = quoteCheckout({ current: paid("growth", 20), purchase: STARTER_YEARLY, currentDailyRatePaise: GROWTH_MONTHLY_RATE, now: NOW });
    expect(q.allowed).toBe(false);
    if (!q.allowed) expect(q.message).toMatch(/You're on Growth until 1 Dec 2026\. You can move to Starter once/);
  });

  it("refuses to renew an open-ended grant", () => {
    const q = quoteCheckout({
      current: { plan: "pro", planExpiresAt: null, planSource: "granted" },
      purchase: STARTER_MONTHLY,
      currentDailyRatePaise: null,
      now: NOW,
    });
    expect(q.allowed).toBe(false);
  });

  it("states the converted days before paying for an upgrade", () => {
    const q = quoteCheckout({ current: paid("pro", 300), purchase: GROWTH_MONTHLY, currentDailyRatePaise: STARTER_YEARLY_RATE, now: NOW });
    expect(q).toMatchObject({ allowed: true, kind: "upgrade", creditDays: 98 });
    if (q.allowed) expect(q.summary).toMatch(/including 98 extra days converted from your unused Starter time/);
  });

  it("states the new end date for a renewal", () => {
    const q = quoteCheckout({ current: paid("pro", 10), purchase: STARTER_MONTHLY, currentDailyRatePaise: STARTER_YEARLY_RATE, now: NOW });
    expect(q).toMatchObject({ allowed: true, kind: "extend" });
    if (q.allowed) expect(q.summary).toBe("Starter until 21 Dec 2026, added to the time you have left.");
  });
});

describe("decidePlanRevocation", () => {
  it("takes back only the refunded payment's days", () => {
    // Two Starter months stacked: 50 days left. Refunding one leaves 20.
    const d = decidePlanRevocation({ current: paid("pro", 50), grantedPlan: "pro", grantedDays: 30, now: NOW });
    expect(d).toEqual({ kind: "revoke", expiresAt: inDays(20) });
  });

  it("ends the period now rather than in the past", () => {
    const d = decidePlanRevocation({ current: paid("pro", 10), grantedPlan: "pro", grantedDays: 30, now: NOW });
    expect(d).toEqual({ kind: "revoke", expiresAt: NOW });
  });

  it("does nothing once the period has already run out", () => {
    expect(decidePlanRevocation({ current: paid("pro", -1), grantedPlan: "pro", grantedDays: 30, now: NOW })).toEqual({ kind: "nothing" });
  });

  it("does nothing for a payment that granted no time", () => {
    expect(decidePlanRevocation({ current: paid("pro", 10), grantedPlan: null, grantedDays: 0, now: NOW })).toEqual({ kind: "nothing" });
  });

  it("sends a refund to a person when the workspace has moved to another tier", () => {
    const d = decidePlanRevocation({ current: paid("growth", 100), grantedPlan: "pro", grantedDays: 30, now: NOW });
    expect(d.kind).toBe("review");
  });

  it("sends a refund to a person when an admin has since granted the plan", () => {
    const d = decidePlanRevocation({
      current: { plan: "pro", planExpiresAt: inDays(50), planSource: "granted" },
      grantedPlan: "pro",
      grantedDays: 30,
      now: NOW,
    });
    expect(d.kind).toBe("review");
  });
});

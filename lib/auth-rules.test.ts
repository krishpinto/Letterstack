import { describe, expect, it } from "vitest";
import { planGoogleClaim, sessionIsCurrent } from "./auth-rules";

const state = (sessionVersion: number) => ({
  email: "a@example.com",
  emailVerifiedAt: new Date(),
  sessionVersion,
});

describe("sessionIsCurrent", () => {
  it("accepts a token at the account's version", () => {
    expect(sessionIsCurrent(3, state(3))).toBe(true);
  });

  it("rejects a token from before a bump", () => {
    expect(sessionIsCurrent(2, state(3))).toBe(false);
  });

  it("treats a pre-versioning token as version 0", () => {
    expect(sessionIsCurrent(undefined, state(0))).toBe(true);
    expect(sessionIsCurrent(undefined, state(1))).toBe(false);
  });

  it("rejects a token for a deleted account", () => {
    expect(sessionIsCurrent(0, null)).toBe(false);
  });
});

describe("planGoogleClaim", () => {
  it("creates an account when none exists", () => {
    expect(planGoogleClaim(null, "Ada")).toEqual({ kind: "create" });
  });

  it("links to an account that already proved its email", () => {
    expect(planGoogleClaim({ emailVerifiedAt: new Date(), name: "Ada" }, "Ada G")).toEqual({
      kind: "link",
      backfillName: false,
    });
  });

  it("takes over an account whose email was never proven", () => {
    expect(planGoogleClaim({ emailVerifiedAt: null, name: "Ada" }, "Ada")).toEqual({
      kind: "takeover",
      backfillName: false,
    });
  });

  it("backfills a missing name from Google", () => {
    expect(planGoogleClaim({ emailVerifiedAt: null, name: null }, "Ada")).toEqual({
      kind: "takeover",
      backfillName: true,
    });
    expect(planGoogleClaim({ emailVerifiedAt: new Date(), name: null }, null)).toEqual({
      kind: "link",
      backfillName: false,
    });
  });
});

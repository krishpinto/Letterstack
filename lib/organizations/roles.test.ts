import { describe, expect, it } from "vitest";

import { decideInviteRole, isManagerRole, roleRank } from "./roles";

describe("roleRank / isManagerRole", () => {
  it("orders owner above admin above member", () => {
    expect(roleRank("owner")).toBeGreaterThan(roleRank("admin"));
    expect(roleRank("admin")).toBeGreaterThan(roleRank("member"));
  });

  it("ranks unknown roles below member", () => {
    expect(roleRank("superuser")).toBeLessThan(roleRank("member"));
    expect(roleRank(null)).toBeLessThan(roleRank("member"));
    // Not fooled by Object.prototype keys.
    expect(roleRank("toString")).toBe(-1);
  });

  it("treats only owners and admins as managers", () => {
    expect(isManagerRole("owner")).toBe(true);
    expect(isManagerRole("admin")).toBe(true);
    expect(isManagerRole("member")).toBe(false);
    expect(isManagerRole(undefined)).toBe(false);
  });
});

describe("decideInviteRole", () => {
  it("refuses plain members entirely", () => {
    expect(decideInviteRole("member", "member").ok).toBe(false);
    expect(decideInviteRole("member", "admin").ok).toBe(false);
    expect(decideInviteRole(null, "member").ok).toBe(false);
  });

  it("lets owners invite members and admins", () => {
    expect(decideInviteRole("owner", "member")).toEqual({ ok: true, role: "member" });
    expect(decideInviteRole("owner", "admin")).toEqual({ ok: true, role: "admin" });
  });

  it("lets admins invite up to their own role", () => {
    expect(decideInviteRole("admin", "member")).toEqual({ ok: true, role: "member" });
    expect(decideInviteRole("admin", "admin")).toEqual({ ok: true, role: "admin" });
  });

  it("never hands out ownership by invite", () => {
    expect(decideInviteRole("owner", "owner").ok).toBe(false);
    expect(decideInviteRole("admin", "owner").ok).toBe(false);
  });

  it("defaults a missing role to member and rejects garbage", () => {
    expect(decideInviteRole("owner", undefined)).toEqual({ ok: true, role: "member" });
    expect(decideInviteRole("owner", "")).toEqual({ ok: true, role: "member" });
    expect(decideInviteRole("owner", 42).ok).toBe(false);
    expect(decideInviteRole("owner", "superuser").ok).toBe(false);
  });
});

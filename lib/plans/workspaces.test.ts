import { describe, expect, it } from "vitest";

import { workspaceAllowance } from "./workspaces";

const NOW = new Date("2026-11-11T06:00:00.000Z");
const LATER = new Date("2027-01-01T00:00:00.000Z");
const EARLIER = new Date("2026-01-01T00:00:00.000Z");

describe("workspaceAllowance", () => {
  it("lets a member of someone else's Free workspace create their own", () => {
    const r = workspaceAllowance([{ role: "member", plan: "free" }], NOW);
    expect(r).toMatchObject({ ok: true, owned: 0, allowance: 1 });
  });

  it("does not lend a member the allowance of a workspace they don't own", () => {
    const r = workspaceAllowance(
      [
        { role: "member", plan: "growth", planExpiresAt: LATER },
        { role: "owner", plan: "free" },
      ],
      NOW,
    );
    expect(r).toMatchObject({ ok: false, owned: 1, allowance: 1, plan: "free" });
  });

  it("uses the best running plan among the workspaces they own", () => {
    const r = workspaceAllowance(
      [
        { role: "owner", plan: "free" },
        { role: "owner", plan: "pro", planExpiresAt: LATER },
      ],
      NOW,
    );
    expect(r).toMatchObject({ ok: true, owned: 2, allowance: 3, plan: "pro" });
  });

  it("ignores a lapsed plan", () => {
    const r = workspaceAllowance([{ role: "owner", plan: "growth", planExpiresAt: EARLIER }], NOW);
    expect(r).toMatchObject({ ok: false, allowance: 1, plan: "free" });
  });
});

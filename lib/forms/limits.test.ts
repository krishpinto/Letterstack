import { describe, expect, it } from "vitest";
import { signupFormLimitProblem } from "./limits";

describe("signupFormLimitProblem", () => {
  it("lets a Free workspace create its first form", () => {
    expect(signupFormLimitProblem("free", 0)).toBeNull();
  });

  it("stops a Free workspace at one form and says how to get more", () => {
    const message = signupFormLimitProblem("free", 1);
    expect(message).toMatch(/1 signup form\b/);
    expect(message).toMatch(/Upgrade/);
  });

  it("stops a Free workspace that kept extra forms from a paid plan", () => {
    expect(signupFormLimitProblem("free", 4)).not.toBeNull();
  });

  it("does not cap paid plans", () => {
    for (const plan of ["pro", "growth", "business"] as const) {
      expect(signupFormLimitProblem(plan, 500)).toBeNull();
    }
  });
});

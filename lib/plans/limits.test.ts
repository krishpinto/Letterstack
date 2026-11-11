import { describe, expect, it } from "vitest";
import { limitsFor, nextPlanUp, normalizePlan, yearlyPricing } from "./limits";

describe("plan limits", () => {
  it("reads an unknown stored plan as free", () => {
    expect(normalizePlan("enterprise")).toBe("free");
    expect(limitsFor("typo").contacts).toBe(limitsFor("free").contacts);
  });

  it("offers the next tier up, and nothing above the top", () => {
    expect(nextPlanUp("free")).toBe("pro");
    expect(nextPlanUp("business")).toBeNull();
  });

  it("prices every yearly plan two months below twelve monthly payments", () => {
    expect(yearlyPricing("pro")?.monthsFree).toBe(2);
    expect(yearlyPricing("free")).toBeNull();
    expect(yearlyPricing("business")).toBeNull();
  });
});

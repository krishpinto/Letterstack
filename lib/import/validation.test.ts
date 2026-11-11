import { describe, expect, it } from "vitest";
import { resolveDomainsAlive } from "./validation";

// No real DNS here: the resolver and the clock are injected.

describe("resolveDomainsAlive", () => {
  it("resolves every domain when there is budget", async () => {
    const result = await resolveDomainsAlive(["a.com", "b.com"], {
      resolve: async (domain) => domain === "a.com",
    });
    expect(result.get("a.com")).toBe(true);
    expect(result.get("b.com")).toBe(false);
  });

  it("stops starting lookups once the budget is spent and marks the rest unknown", async () => {
    let clock = 0;
    const looked: string[] = [];
    const domains = Array.from({ length: 50 }, (_, i) => `d${i}.com`);
    const result = await resolveDomainsAlive(domains, {
      budgetMs: 100,
      now: () => clock,
      resolve: async (domain) => {
        looked.push(domain);
        clock += 10; // every lookup costs 10ms of fake time
        return true;
      },
    });

    expect(looked.length).toBeLessThan(domains.length);
    expect(result.size).toBe(domains.length);
    const unknown = domains.filter((d) => result.get(d) === null);
    expect(unknown.length).toBe(domains.length - looked.length);
    // Unknown is never "dead": those addresses are kept.
    expect([...result.values()].includes(false)).toBe(false);
  });
});

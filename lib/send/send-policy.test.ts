import { describe, expect, it } from "vitest";
import { decideCampaignOutcome } from "./send-policy";

const counts = (over: Partial<Parameters<typeof decideCampaignOutcome>[0]>) => ({
  pending: 0,
  sending: 0,
  sent: 0,
  failed: 0,
  ...over,
});

describe("decideCampaignOutcome", () => {
  it("keeps a campaign open while anything is pending or in flight", () => {
    expect(decideCampaignOutcome(counts({ pending: 1, sent: 5 }))).toBe("in_progress");
    expect(decideCampaignOutcome(counts({ sending: 1, sent: 5 }))).toBe("in_progress");
  });

  it("closes a campaign once every recipient has an outcome", () => {
    expect(decideCampaignOutcome(counts({ sent: 5, failed: 1 }))).toBe("sent");
  });
});

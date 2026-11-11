import { describe, expect, it } from "vitest";
import { campaignRates, formatRate, ratio, sumRateInputs, toPercent } from "./rates";

const base = {
  sent: 1000,
  delivered: 950,
  bounced: 50,
  complained: 1,
  opensUnique: 380,
  clicksUnique: 95,
  unsubscribed: 4,
};

describe("ratio", () => {
  it("is null when there is nothing to divide by", () => {
    expect(ratio(5, 0)).toBeNull();
    expect(ratio(0, 0)).toBeNull();
  });

  it("is 0 when the part is empty", () => {
    expect(ratio(0, 10)).toBe(0);
  });
});

describe("campaignRates", () => {
  it("divides bounces by sent, not delivered", () => {
    expect(campaignRates(base).bounceRate).toBe(0.05);
  });

  it("divides opens and clicks by delivered", () => {
    const rates = campaignRates(base);
    expect(rates.openRate).toBe(380 / 950);
    expect(rates.clickRate).toBe(95 / 950);
    expect(rates.clickToOpenRate).toBe(95 / 380);
  });

  it("divides complaints and unsubscribes by delivered", () => {
    const rates = campaignRates(base);
    expect(rates.complaintRate).toBe(1 / 950);
    expect(rates.unsubscribeRate).toBe(4 / 950);
  });

  it("reports delivery as delivered over sent", () => {
    expect(campaignRates(base).deliveryRate).toBe(0.95);
  });

  it("returns null rates before any delivery events arrive", () => {
    const rates = campaignRates({ ...base, delivered: 0, opensUnique: 0, clicksUnique: 0 });
    expect(rates.openRate).toBeNull();
    expect(rates.clickRate).toBeNull();
    expect(rates.bounceRate).toBe(0.05);
  });
});

describe("sumRateInputs", () => {
  it("adds every field and treats missing unsubscribes as 0", () => {
    const { unsubscribed: _ignored, ...withoutUnsubs } = base;
    void _ignored;
    const total = sumRateInputs([base, withoutUnsubs]);
    expect(total.sent).toBe(2000);
    expect(total.unsubscribed).toBe(4);
  });
});

describe("formatting", () => {
  it("formats null as a dash and rounds percentages", () => {
    expect(formatRate(null)).toBe("—");
    expect(formatRate(0.12345)).toBe("12.3%");
    expect(formatRate(0.12345, 2)).toBe("12.35%");
    expect(toPercent(null)).toBe(0);
  });
});

import { describe, expect, it } from "vitest";

import {
  budgetBreach,
  checkAgentRequestShape,
  estimateCallTokens,
  MAX_AGENT_BODY_CHARS,
  MAX_AGENT_MESSAGES,
  RESERVED_OVERHEAD_TOKENS,
  type BudgetCounts,
  type BudgetLimits,
} from "./guards";

describe("checkAgentRequestShape", () => {
  it("accepts a normal request", () => {
    expect(checkAgentRequestShape({ bodyChars: 20_000, messages: [{}, {}] })).toEqual({ ok: true });
  });

  it("rejects an oversized body before looking at messages", () => {
    const result = checkAgentRequestShape({ bodyChars: MAX_AGENT_BODY_CHARS + 1, messages: [{}] });
    expect(result).toMatchObject({ ok: false, status: 413 });
  });

  it("rejects missing, empty or non-array messages", () => {
    expect(checkAgentRequestShape({ bodyChars: 10, messages: undefined })).toMatchObject({ status: 400 });
    expect(checkAgentRequestShape({ bodyChars: 10, messages: [] })).toMatchObject({ status: 400 });
    expect(checkAgentRequestShape({ bodyChars: 10, messages: "hi" })).toMatchObject({ status: 400 });
  });

  it("rejects too many messages", () => {
    const messages = Array.from({ length: MAX_AGENT_MESSAGES + 1 }, () => ({}));
    expect(checkAgentRequestShape({ bodyChars: 10, messages })).toMatchObject({ status: 413 });
  });
});

describe("estimateCallTokens", () => {
  it("charges a quarter token per character plus fixed overhead", () => {
    expect(estimateCallTokens(0)).toBe(RESERVED_OVERHEAD_TOKENS);
    expect(estimateCallTokens(4_000)).toBe(1_000 + RESERVED_OVERHEAD_TOKENS);
  });
});

describe("budgetBreach", () => {
  const limits: BudgetLimits = {
    rpmLimit: 10,
    dailyRequestLimit: 100,
    dailyTokenLimit: 100_000,
    userRpmLimit: 12,
    monthlyTokenLimit: 1_000_000,
  };
  // Counts include this call's own reservation of 5k tokens.
  const own = 5_000;
  const fresh: BudgetCounts = {
    modelRequestsLastMinute: 1,
    modelRequestsToday: 1,
    modelTokensToday: own,
    userRequestsLastMinute: 1,
    userTokensThisMonth: own,
  };

  it("passes a first call", () => {
    expect(budgetBreach(fresh, limits, own)).toBeNull();
  });

  it("allows exactly the limit's worth of calls, counting this one", () => {
    expect(budgetBreach({ ...fresh, modelRequestsLastMinute: 10 }, limits, own)).toBeNull();
    expect(budgetBreach({ ...fresh, modelRequestsLastMinute: 11 }, limits, own)).toBe("model-rpm");
  });

  it("sees parallel reservations, so a burst cannot all pass", () => {
    // Twenty requests fired at once: each one's count includes all the
    // others' reservations, so none of them sees a quiet minute.
    const burst = { ...fresh, modelRequestsLastMinute: 20, userRequestsLastMinute: 20 };
    expect(budgetBreach(burst, limits, own)).not.toBeNull();
  });

  it("caps one user's call rate regardless of the step count the client sends", () => {
    const user = { ...fresh, userRequestsLastMinute: 13 };
    expect(budgetBreach(user, { ...limits, rpmLimit: 100 }, own)).toBe("user-rpm");
  });

  it("refuses once the day's requests are spent", () => {
    expect(budgetBreach({ ...fresh, modelRequestsToday: 101 }, limits, own)).toBe(
      "model-daily-requests",
    );
  });

  it("judges token limits on usage before this call", () => {
    // 99,999 used before this call: under the limit, so this call may run.
    expect(budgetBreach({ ...fresh, modelTokensToday: 99_999 + own }, limits, own)).toBeNull();
    expect(budgetBreach({ ...fresh, modelTokensToday: 100_000 + own }, limits, own)).toBe(
      "model-daily-tokens",
    );
    expect(
      budgetBreach({ ...fresh, userTokensThisMonth: 1_000_000 + own }, limits, own),
    ).toBe("user-monthly-tokens");
  });

  it("counts other in-flight reservations against the token budget", () => {
    // 90k settled plus three other in-flight 5k reservations = 105k before us.
    const counts = { ...fresh, modelTokensToday: 90_000 + 3 * own + own };
    expect(budgetBreach(counts, limits, own)).toBe("model-daily-tokens");
  });
});

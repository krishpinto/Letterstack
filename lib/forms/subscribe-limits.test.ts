import { describe, expect, it } from "vitest";
import { SUBSCRIBE_LIMITS, subscribeRateLimitChecks } from "./subscribe-limits";

describe("subscribeRateLimitChecks", () => {
  const checks = subscribeRateLimitChecks("formKey1", "203.0.113.7");
  const keys = checks.map((check) => check.key);

  it("counts the visitor on this form, the visitor overall, and the form overall", () => {
    expect(keys).toEqual([
      "subscribe:form:formKey1:ip:203.0.113.7",
      "subscribe:ip:203.0.113.7",
      "subscribe:form:formKey1",
    ]);
  });

  it("shares the per-IP counter across forms", () => {
    const other = subscribeRateLimitChecks("formKey2", "203.0.113.7").map((c) => c.key);
    expect(other[1]).toBe(keys[1]);
    expect(other[0]).not.toBe(keys[0]);
    expect(other[2]).not.toBe(keys[2]);
  });

  it("shares the per-form counter across visitors", () => {
    const other = subscribeRateLimitChecks("formKey1", "198.51.100.1").map((c) => c.key);
    expect(other[2]).toBe(keys[2]);
  });

  it("is strictest for one visitor on one form", () => {
    const { perIpPerForm, perIp, perForm } = SUBSCRIBE_LIMITS;
    expect(perIpPerForm.limit).toBeLessThan(perIp.limit);
    expect(perIp.limit).toBeLessThan(perForm.limit);
  });
});

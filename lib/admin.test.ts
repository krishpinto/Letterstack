import { afterEach, describe, expect, it } from "vitest";
import { isAdmin } from "./admin";

const original = process.env.ADMIN_EMAILS;
afterEach(() => {
  process.env.ADMIN_EMAILS = original;
});

describe("isAdmin", () => {
  it("accepts a verified email on the allowlist, case-insensitively", () => {
    process.env.ADMIN_EMAILS = "Founder@Example.com, other@example.com";
    expect(isAdmin({ email: "founder@example.com", hasVerifiedEmail: true })).toBe(true);
  });

  it("rejects an allowlisted email that was never verified", () => {
    process.env.ADMIN_EMAILS = "founder@example.com";
    expect(isAdmin({ email: "founder@example.com", hasVerifiedEmail: false })).toBe(false);
    expect(isAdmin({ email: "founder@example.com" })).toBe(false);
  });

  it("rejects verified emails not on the list, and no user at all", () => {
    process.env.ADMIN_EMAILS = "founder@example.com";
    expect(isAdmin({ email: "someone@example.com", hasVerifiedEmail: true })).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it("rejects everyone when the list is unset", () => {
    delete process.env.ADMIN_EMAILS;
    expect(isAdmin({ email: "founder@example.com", hasVerifiedEmail: true })).toBe(false);
  });
});

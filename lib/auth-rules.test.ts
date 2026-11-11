import { describe, expect, it } from "vitest";
import { sessionIsCurrent } from "./auth-rules";

const state = (sessionVersion: number) => ({
  email: "a@example.com",
  sessionVersion,
});

describe("sessionIsCurrent", () => {
  it("accepts a token at the account's version", () => {
    expect(sessionIsCurrent(3, state(3))).toBe(true);
  });

  it("rejects a token from before a bump", () => {
    expect(sessionIsCurrent(2, state(3))).toBe(false);
  });

  it("treats a pre-versioning token as version 0", () => {
    expect(sessionIsCurrent(undefined, state(0))).toBe(true);
    expect(sessionIsCurrent(undefined, state(1))).toBe(false);
  });

  it("rejects a token for a deleted account", () => {
    expect(sessionIsCurrent(0, null)).toBe(false);
  });
});

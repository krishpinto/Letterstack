import { describe, expect, it } from "vitest";

import { createSlidingWindowLimiter, EMAIL_IMAGE_ACCEPT } from "./limits";

describe("createSlidingWindowLimiter", () => {
  it("allows up to max attempts per window, then refuses", () => {
    const limited = createSlidingWindowLimiter(1000, 3);
    expect(limited("u1", 0)).toBe(false);
    expect(limited("u1", 10)).toBe(false);
    expect(limited("u1", 20)).toBe(false);
    expect(limited("u1", 30)).toBe(true);
  });

  it("counts each key separately", () => {
    const limited = createSlidingWindowLimiter(1000, 1);
    expect(limited("u1", 0)).toBe(false);
    expect(limited("u2", 0)).toBe(false);
    expect(limited("u1", 1)).toBe(true);
  });

  it("frees capacity as old attempts leave the window", () => {
    const limited = createSlidingWindowLimiter(1000, 2);
    limited("u1", 0);
    limited("u1", 500);
    expect(limited("u1", 900)).toBe(true);
    // The attempt at 0 has aged out; refused attempts were never counted.
    expect(limited("u1", 1001)).toBe(false);
  });
});

describe("EMAIL_IMAGE_ACCEPT", () => {
  it("excludes SVG", () => {
    expect(EMAIL_IMAGE_ACCEPT).not.toContain("svg");
  });
});

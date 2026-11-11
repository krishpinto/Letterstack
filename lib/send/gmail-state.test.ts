import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  GMAIL_STATE_MAX_AGE_MS,
  newGmailNonce,
  safeEqual,
  signGmailState,
  verifyGmailState,
} from "./gmail-state";

const SECRET = "test-secret";
const NOW = Date.UTC(2026, 0, 1);
const claim = {
  userId: "user-1",
  organizationId: "org-1",
  nonce: "nonce-abc",
  issuedAt: NOW,
};

describe("gmail OAuth state", () => {
  it("round-trips a fresh state", () => {
    const state = signGmailState(claim, SECRET);
    expect(verifyGmailState(state, SECRET, NOW + 1000)).toEqual(claim);
  });

  it("rejects a state signed with another secret", () => {
    const state = signGmailState(claim, "other-secret");
    expect(verifyGmailState(state, SECRET, NOW)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const [, sig] = signGmailState(claim, SECRET).split(".");
    const forged = Buffer.from(JSON.stringify({ u: "attacker", o: "org-1", n: "x", t: NOW }))
      .toString("base64url");
    expect(verifyGmailState(`${forged}.${sig}`, SECRET, NOW)).toBeNull();
  });

  it("rejects a state older than the max age", () => {
    const state = signGmailState(claim, SECRET);
    expect(verifyGmailState(state, SECRET, NOW + GMAIL_STATE_MAX_AGE_MS)).not.toBeNull();
    expect(verifyGmailState(state, SECRET, NOW + GMAIL_STATE_MAX_AGE_MS + 1)).toBeNull();
  });

  it("rejects a state dated well into the future", () => {
    const state = signGmailState({ ...claim, issuedAt: NOW + 5 * 60_000 }, SECRET);
    expect(verifyGmailState(state, SECRET, NOW)).toBeNull();
  });

  it("rejects the old format with no nonce or timestamp", () => {
    const payload = Buffer.from(JSON.stringify({ u: "user-1", o: "org-1" })).toString("base64url");
    const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
    expect(verifyGmailState(`${payload}.${sig}`, SECRET, NOW)).toBeNull();
  });

  it("rejects garbage", () => {
    expect(verifyGmailState("", SECRET, NOW)).toBeNull();
    expect(verifyGmailState("abc", SECRET, NOW)).toBeNull();
    expect(verifyGmailState("a.b.c", SECRET, NOW)).toBeNull();
  });
});

describe("helpers", () => {
  it("makes distinct url-safe nonces", () => {
    const a = newGmailNonce();
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(newGmailNonce()).not.toBe(a);
  });

  it("compares strings in constant time without throwing on length mismatch", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

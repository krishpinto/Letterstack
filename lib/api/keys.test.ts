import { describe, expect, it } from "vitest";

import { isApiKeyUsable } from "./keys";

describe("isApiKeyUsable", () => {
  it("accepts a live key whose creator is still a member", () => {
    expect(isApiKeyUsable({ revokedAt: null, creatorRole: "admin" })).toBe(true);
    expect(isApiKeyUsable({ revokedAt: null, creatorRole: "member" })).toBe(true);
  });

  it("rejects a revoked key", () => {
    expect(isApiKeyUsable({ revokedAt: new Date(), creatorRole: "owner" })).toBe(false);
  });

  it("rejects a key whose creator has left or been removed", () => {
    expect(isApiKeyUsable({ revokedAt: null, creatorRole: null })).toBe(false);
  });
});

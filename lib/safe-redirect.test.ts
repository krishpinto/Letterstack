import { describe, expect, it } from "vitest";
import { safeCallbackPath } from "./safe-redirect";

const origin = "https://letterstack.site";

describe("safeCallbackPath", () => {
  it("keeps a relative path with its query and hash", () => {
    expect(safeCallbackPath("/dashboard/send?id=1#top", origin)).toBe("/dashboard/send?id=1#top");
  });

  it("reduces a same-origin absolute URL to its path", () => {
    expect(safeCallbackPath("https://letterstack.site/editor?x=1", origin)).toBe("/editor?x=1");
  });

  it("keeps invite links", () => {
    expect(safeCallbackPath("/invite/abc_DEF-123", origin)).toBe("/invite/abc_DEF-123");
  });

  it.each([
    "https://evil.com/dashboard",
    "//evil.com/dashboard",
    "/\\evil.com",
    "\\\\evil.com",
    "javascript:alert(1)",
    "http://letterstack.site/dashboard",
  ])("rejects %s", (raw) => {
    expect(safeCallbackPath(raw, origin)).toBeNull();
  });

  it("rejects the auth pages so sign-in can't loop", () => {
    expect(safeCallbackPath("/login?callbackUrl=/x", origin)).toBeNull();
    expect(safeCallbackPath("/signup", origin)).toBeNull();
  });

  it("returns null for nothing", () => {
    expect(safeCallbackPath(null, origin)).toBeNull();
    expect(safeCallbackPath("", origin)).toBeNull();
  });
});

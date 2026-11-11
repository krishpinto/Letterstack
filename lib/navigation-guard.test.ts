import { describe, expect, it } from "vitest";
import { leavesPage, type AnchorInfo, type ClickInfo } from "./navigation-guard";

const CURRENT = "https://letterstack.test/editor/form/abc?tab=style";

const plainClick: ClickInfo = {
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
};

function link(href: string, extra: Partial<AnchorInfo> = {}): AnchorInfo {
  return { href, target: "", hasDownload: false, ...extra };
}

describe("leavesPage", () => {
  it("guards a plain click to another page in the app", () => {
    expect(leavesPage(plainClick, link("https://letterstack.test/dashboard/forms"), CURRENT)).toBe(true);
  });

  it("guards a click to another site", () => {
    expect(leavesPage(plainClick, link("https://example.com/"), CURRENT)).toBe(true);
  });

  it("guards a change of query string on the same path", () => {
    expect(leavesPage(plainClick, link("https://letterstack.test/editor/form/abc?tab=fields"), CURRENT)).toBe(true);
  });

  it("ignores links that only change the hash", () => {
    expect(leavesPage(plainClick, link("https://letterstack.test/editor/form/abc?tab=style#preview"), CURRENT)).toBe(false);
  });

  it("ignores clicks that open a new tab", () => {
    for (const key of ["metaKey", "ctrlKey", "shiftKey", "altKey"] as const) {
      expect(leavesPage({ ...plainClick, [key]: true }, link("/dashboard"), CURRENT)).toBe(false);
    }
    expect(leavesPage({ ...plainClick, button: 1 }, link("/dashboard"), CURRENT)).toBe(false);
    expect(leavesPage(plainClick, link("/dashboard", { target: "_blank" }), CURRENT)).toBe(false);
  });

  it("ignores downloads, mailto links and clicks already handled", () => {
    expect(leavesPage(plainClick, link("/export.csv", { hasDownload: true }), CURRENT)).toBe(false);
    expect(leavesPage(plainClick, link("mailto:hi@example.com"), CURRENT)).toBe(false);
    expect(leavesPage({ ...plainClick, defaultPrevented: true }, link("/dashboard"), CURRENT)).toBe(false);
  });

  it("treats target=_self like no target", () => {
    expect(leavesPage(plainClick, link("/dashboard", { target: "_self" }), CURRENT)).toBe(true);
  });
});

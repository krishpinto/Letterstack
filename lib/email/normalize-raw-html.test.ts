// @vitest-environment jsdom
// normalizeRawHtml() parses with the browser's DOMParser, so this file runs
// in jsdom rather than the default node environment.
import { describe, expect, it } from "vitest";
import { normalizeRawHtml } from "./normalize-raw-html";

describe("normalizeRawHtml", () => {
  it.each([
    `<img src="x"/onerror="fetch('/api/campaigns')">`,
    `<svg/onload=alert(1)>`,
    `<a href=javascript:alert(1)>x</a>`,
    `<a href="jav&#x61;script:alert(1)">x</a>`,
    `<iframe srcdoc="<script>alert(1)</script>"></iframe>`,
  ])("returns inert HTML for %s", (payload) => {
    const { html } = normalizeRawHtml(payload);
    expect(html.toLowerCase()).not.toMatch(/onerror|onload|javascript:|<svg|<iframe|srcdoc/);
  });

  it("unwraps a full document and keeps email markup", () => {
    const { html, text, warnings } = normalizeRawHtml(
      '<!doctype html><html><head><style>p{}</style></head><body><table><tbody><tr><td style="padding:8px;">Hi <a href="https://a.com">there</a></td></tr></tbody></table></body></html>',
    );
    expect(html).toBe(
      '<table><tbody><tr><td style="padding:8px;">Hi <a href="https://a.com">there</a></td></tr></tbody></table>',
    );
    expect(text).toContain("Hi");
    expect(warnings.some((w) => w.includes("<body>"))).toBe(true);
  });

  it("removes and reports class attributes and positioning", () => {
    const { html, warnings } = normalizeRawHtml(
      '<div class="fixed inset-0" style="position:fixed;color:#333333;">x</div>',
    );
    expect(html).not.toMatch(/class=|position/);
    expect(warnings.join(" ")).toMatch(/class/);
    expect(warnings.join(" ")).toMatch(/positioning/);
  });
});

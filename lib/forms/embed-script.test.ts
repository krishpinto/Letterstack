import { describe, expect, it } from "vitest";
import {
  buildEmbedScript,
  embedConfigLiteral,
  embedPresentation,
} from "./embed-script";
import type { WidgetConfig } from "./widget";
import { LIGHT } from "./style";

function config(overrides: Partial<WidgetConfig> = {}): WidgetConfig {
  return {
    key: "abc123",
    formType: "static",
    headline: "Subscribe",
    description: "Monthly news",
    buttonLabel: "Join",
    successMessage: "Thanks!",
    accentColor: "#4f46e5",
    collectName: false,
    layout: "card",
    radius: 10,
    colors: LIGHT,
    apiUrl: "https://letterstack.test/api/public/subscribe",
    ...overrides,
  };
}

describe("embedPresentation", () => {
  it("renders static forms inline", () => {
    expect(embedPresentation("static")).toEqual({ mode: "inline" });
  });

  it("renders popups as a delayed modal and animated forms as a corner panel", () => {
    expect(embedPresentation("popup")).toMatchObject({ mode: "modal" });
    expect(embedPresentation("animated")).toMatchObject({ mode: "corner" });
  });

  it("waits before opening on its own and snoozes after a dismissal", () => {
    for (const type of ["popup", "animated"] as const) {
      const presentation = embedPresentation(type);
      if (presentation.mode === "inline") throw new Error("expected an overlay");
      expect(presentation.openDelayMs).toBeGreaterThan(0);
      expect(presentation.snoozeMs).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000);
    }
  });
});

describe("buildEmbedScript", () => {
  it("produces valid JavaScript for every form type and layout", () => {
    for (const formType of ["static", "popup", "animated"] as const) {
      for (const layout of ["card", "minimal", "inline"] as const) {
        const script = buildEmbedScript(config({ formType, layout }));
        // Compiles without running.
        expect(() => new Function(script)).not.toThrow();
      }
    }
  });

  it("carries form wording only as data, never as markup", () => {
    const hostile = '"</script><img src=x onerror=alert(1)>';
    const script = buildEmbedScript(
      config({ headline: hostile, description: hostile, successMessage: hostile }),
    );
    expect(script).not.toContain("<img");
    expect(script).not.toContain("</script>");
    expect(script).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  });

  it("round-trips the config, including characters that break naive embedding", () => {
    const tricky = "Line\u2028sep \u2029 <b> \"quoted\" \\ back";
    const literal = embedConfigLiteral(config({ headline: tricky }));
    expect(literal).not.toMatch(/[<\u2028\u2029]/);
    expect(JSON.parse(literal).headline).toBe(tricky);
    expect(JSON.parse(literal).presentation).toEqual({ mode: "inline" });
  });
});

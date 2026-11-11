import { describe, expect, it } from "vitest";
import { compileEmailDocument } from "./compiler";
import { normalizeDocument } from "./document";
import { sanitizeEmailDocument } from "./sanitize";
import { PREBUILT_TEMPLATES, blankDocument } from "./templates";

// Gmail clips a message whose HTML is over about 102KB and hides the rest
// behind "View entire message", which also hides the open-tracking pixel.
const GMAIL_CLIP_BYTES = 102 * 1024;

const STARTERS = [
  ...PREBUILT_TEMPLATES.map((t) => [t.id, t.build] as const),
  ["blank", blankDocument] as const,
];

describe.each(STARTERS)("starter template %s", (_id, build) => {
  it("compiles under Gmail's clipping size with no script URLs", () => {
    const { html, text } = compileEmailDocument(normalizeDocument(build()));
    expect(Buffer.byteLength(html, "utf8")).toBeLessThan(GMAIL_CLIP_BYTES);
    expect(html).not.toMatch(/javascript:/i);
    expect(text).not.toMatch(/javascript:/i);
  });

  it("passes through the sanitizer unchanged", () => {
    // If this fails, the sanitizer would rewrite a template the moment a
    // user saves it — loosen the rule, or fix the template.
    const doc = normalizeDocument(build());
    expect(sanitizeEmailDocument(doc)).toEqual(doc);
  });
});

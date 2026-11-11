// @vitest-environment jsdom
// The compiler is pure, but its output is checked by parsing it the way a
// browser or mail client would — jsdom provides the DOMParser.
import { describe, expect, it } from "vitest";
import { compileEmailDocument } from "./compiler";
import {
  createBlock,
  createColumn,
  createDocument,
  type EmailBlock,
  type EmailDocument,
} from "./document";

function doc(blocks: EmailBlock[], patch: Partial<EmailDocument["settings"]> = {}) {
  const document = createDocument({ blocks });
  document.settings = { ...document.settings, ...patch };
  return document;
}

function block<T extends EmailBlock["type"]>(
  type: T,
  patch: Partial<Extract<EmailBlock, { type: T }>> = {},
): EmailBlock {
  return { ...createBlock(type), ...patch } as EmailBlock;
}

function parse(html: string) {
  return new DOMParser().parseFromString(html, "text/html");
}

/** Every attribute on every element whose name starts with "on". */
function eventHandlers(html: string): string[] {
  return [...parse(html).querySelectorAll("*")].flatMap((el) =>
    [...el.attributes].map((a) => a.name).filter((name) => name.startsWith("on")),
  );
}

const INJECTION = `red;" onmouseover="alert(1)`;

describe("compileEmailDocument: attribute values", () => {
  it("does not let a theme colour break out of style=\"\"", () => {
    const { html } = compileEmailDocument(
      doc([block("button"), block("text"), block("columns")], {
        backgroundColor: INJECTION,
        contentColor: INJECTION,
        textColor: INJECTION,
        accentColor: INJECTION,
        linkColor: INJECTION,
        buttonBackgroundColor: INJECTION,
        buttonTextColor: INJECTION,
        fontFamily: `Arial" onclick="alert(1)`,
      }),
    );
    expect(eventHandlers(html)).toEqual([]);
    expect(html).not.toContain("alert(1)");
  });

  it("does not let a block colour break out of style=\"\"", () => {
    const { html } = compileEmailDocument(
      doc([
        block("paragraph", { textColor: INJECTION, backgroundColor: INJECTION }),
        block("columns", { borderStyle: "solid", borderColor: INJECTION, columnBackgroundColor: INJECTION }),
      ]),
    );
    expect(eventHandlers(html)).toEqual([]);
    expect(html).not.toContain("alert(1)");
  });

  it("replaces an invalid colour with the default", () => {
    const { html } = compileEmailDocument(doc([], { backgroundColor: INJECTION }));
    expect(html).toContain("background:#f0ece8;");
  });

  it("keeps quoted font names inside the style attribute", () => {
    const font = "'Trebuchet MS', Tahoma, sans-serif";
    const { html } = compileEmailDocument(doc([block("paragraph")], { fontFamily: font }));
    const p = parse(html).querySelector("td div p") as HTMLElement;
    expect(p.getAttribute("style")).toContain(`font-family:${font}`);
  });

  it("escapes text fields that land in attributes", () => {
    const { html } = compileEmailDocument(
      doc([block("image", { src: "https://a.com/i.png", alt: `x" onerror="alert(1)` })]),
    );
    expect(eventHandlers(html)).toEqual([]);
    expect(parse(html).querySelector("img")?.getAttribute("alt")).toBe(`x" onerror="alert(1)`);
  });

  it("sanitizes stored HTML on the way out", () => {
    const column = { ...createColumn(), body: `<img src=x onerror=alert(1)>ok` };
    const { html } = compileEmailDocument(
      doc([
        block("paragraph", { body: `<p>hi<svg/onload=alert(1)></p>` }),
        block("rawHtml", { html: `<a href="jav&#x61;script:alert(1)">x</a>` }),
        block("columns", { columns: [column] }),
      ]),
    );
    expect(eventHandlers(html)).toEqual([]);
    expect(html).not.toMatch(/javascript:|<svg/i);
  });
});

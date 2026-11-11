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

/** Every href in the compiled HTML, in document order. */
function hrefs(html: string): string[] {
  return [...parse(html).querySelectorAll("a[href]")].map((a) => a.getAttribute("href") ?? "");
}

describe("compileEmailDocument: links", () => {
  const bad = "javascript:alert(1)";

  it("drops javascript: and other unsafe links from every link field", () => {
    const { html, text } = compileEmailDocument(
      doc([
        block("button", { href: bad, secondaryLabel: "Two", secondaryHref: "jav&#x61;script:x" }),
        block("image", { src: "https://a.com/i.png", href: bad }),
        block("logo", { src: "https://a.com/l.png", href: "vbscript:x" }),
        block("video", { url: "data:text/html,x" }),
        block("social", { links: [{ id: "s", platform: "twitter", url: bad }] }),
        block("articleCard", { linkUrl: bad, showCta: true, linkLabel: "Read" }),
        block("columns", {
          columns: [{ ...createColumn(), showCta: true, linkLabel: "Go", linkUrl: bad }],
        }),
      ]),
    );
    expect(html).not.toMatch(/javascript:|vbscript:|data:text/i);
    expect(text).not.toMatch(/javascript:|vbscript:|data:text/i);
    // Only the compiler's own unsubscribe link is left.
    expect(hrefs(html)).toEqual(["{{unsubscribe_url}}"]);
  });

  it("gives bare domains a scheme instead of a relative href", () => {
    const { html, text } = compileEmailDocument(
      doc([
        block("button", { href: "example.com/signup" }),
        block("articleCard", { linkUrl: "www.shop.co.uk", showCta: true, linkLabel: "Shop" }),
      ]),
    );
    expect(hrefs(html)).toEqual([
      "https://example.com/signup",
      "https://www.shop.co.uk",
      "{{unsubscribe_url}}",
    ]);
    expect(text).toContain("https://example.com/signup");
  });

  it("keeps http(s), mailto, tel and the unsubscribe placeholder", () => {
    const { html } = compileEmailDocument(
      doc([
        block("button", {
          href: "mailto:hi@a.com",
          secondaryLabel: "Call",
          secondaryHref: "tel:+15550000",
        }),
        block("image", { src: "https://a.com/i.png", href: "{{unsubscribe_url}}" }),
        block("logo", { src: "https://a.com/l.png", href: "http://a.com" }),
      ]),
    );
    expect(hrefs(html)).toEqual([
      "mailto:hi@a.com",
      "tel:+15550000",
      "{{unsubscribe_url}}",
      "http://a.com",
      "{{unsubscribe_url}}",
    ]);
  });

  it("leaves out images it has no usable URL for", () => {
    const { html } = compileEmailDocument(
      doc([block("image", { src: "/relative.png" }), block("logo", { src: "javascript:x" })]),
    );
    expect(parse(html).querySelectorAll("img")).toHaveLength(0);
  });
});

describe("compileEmailDocument: Outlook", () => {
  it("wraps the content in a fixed-width table only Outlook sees", () => {
    const { html } = compileEmailDocument(doc([block("paragraph")], { maxWidth: 640 }));
    expect(html).toContain(
      '<!--[if mso]><table role="presentation" align="center" width="640"',
    );
    expect(html).toContain("<!--[if mso]></td></tr></table><![endif]-->");
  });

  it("renders buttons as table cells that Outlook pads", () => {
    const { html } = compileEmailDocument(
      doc([block("button", { label: "Buy", href: "https://a.com", secondaryLabel: "More", secondaryHref: "https://b.com" })]),
    );
    const cells = [...parse(html).querySelectorAll("td[bgcolor]")];
    expect(cells).toHaveLength(2);
    for (const cell of cells) {
      expect(cell.getAttribute("style")).toContain("mso-padding-alt:14px 18px;");
      expect(cell.querySelector("a")?.getAttribute("href")).toMatch(/^https:/);
    }
    expect(cells[0].textContent?.trim()).toBe("Buy");
  });

  it("stacks stretched buttons at full width", () => {
    const { html } = compileEmailDocument(
      doc([block("button", { fullWidth: true, secondaryLabel: "More", secondaryHref: "https://b.com" })]),
    );
    const cells = [...parse(html).querySelectorAll("td[bgcolor]")];
    expect(cells.map((c) => c.getAttribute("width"))).toEqual(["100%", "100%"]);
    expect(cells[0].parentElement).not.toBe(cells[1].parentElement);
  });

  it("gives every image a numeric width attribute", () => {
    const { html } = compileEmailDocument(
      doc([
        block("logo", { src: "https://a.com/l.png", width: 40 }),
        block("image", { src: "https://a.com/i.png", width: 50 }),
        block("articleCard", { imageSrc: "https://a.com/a.png" }),
        block("columns", {
          gap: 16,
          cellPadding: 12,
          borderStyle: "none",
          columns: [
            { ...createColumn(), showImage: true, imageSrc: "https://a.com/c1.png" },
            { ...createColumn(), showImage: true, imageSrc: "https://a.com/c2.png" },
          ],
        }),
      ]),
    );
    const widths = [...parse(html).querySelectorAll("img")].map((img) => img.getAttribute("width"));
    // 600px container, 24px side padding → 552px of content.
    expect(widths).toEqual([
      "200", // logo: 40% of 552 = 221, capped at 200
      "300", // image: 50% of the 600px container
      "214", // article: 40% of (552 - 16)
      "244", // columns: (552 - 16) / 2 - 2 × 12
      "244",
    ]);
  });
});

describe("compileEmailDocument: block options match the canvas", () => {
  it("uses the columns block's own text colour, like the canvas", () => {
    const { html } = compileEmailDocument(
      doc([block("columns", { textColor: "#123456", columns: [{ ...createColumn(), heading: "<p>H</p>" }] })]),
    );
    const heading = parse(html).querySelector("td.ls-col h3") as HTMLElement;
    expect(heading.getAttribute("style")).toContain("color:#123456;");
  });

  it("uses the custom HTML block's own text colour", () => {
    const { html } = compileEmailDocument(
      doc([block("rawHtml", { html: "<p>x</p>", textColor: "#654321" })]),
    );
    expect(html).toContain("color:#654321;");
  });

  it("writes reversed columns in a right-to-left row so mobile stacks them last-first", () => {
    const columns = ["A", "B", "C"].map((heading) => ({ ...createColumn(), heading }));
    const render = (mobile: "stack" | "stack-reverse") =>
      parse(compileEmailDocument(doc([block("columns", { mobile, columns })])).html);

    const reversed = render("stack-reverse");
    const table = reversed.querySelector("td.ls-col")?.closest("table");
    expect(table?.getAttribute("dir")).toBe("rtl");
    expect([...reversed.querySelectorAll("td.ls-col")].map((td) => td.getAttribute("dir"))).toEqual(["ltr", "ltr", "ltr"]);
    expect([...reversed.querySelectorAll("td.ls-col h3")].map((h) => h.textContent)).toEqual(["C", "B", "A"]);

    const stacked = render("stack");
    expect(stacked.querySelector("td.ls-col")?.closest("table")?.hasAttribute("dir")).toBe(false);
    expect([...stacked.querySelectorAll("td.ls-col h3")].map((h) => h.textContent)).toEqual(["A", "B", "C"]);
  });
});

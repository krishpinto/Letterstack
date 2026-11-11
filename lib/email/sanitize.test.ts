import { describe, expect, it } from "vitest";
import { createBlock, createColumn, createDocument, type EmailBlock } from "./document";
import {
  normalizeImageUrl,
  normalizeLinkUrl,
  safeColor,
  safeFontFamily,
  safeNumber,
  sanitizeEmailDocument,
  sanitizeEmailHtml,
  sanitizeUrl,
} from "./sanitize";

// Every payload here passed through the old regex sanitizer unchanged.
const XSS_PAYLOADS = [
  `<img src="x"/onerror="fetch('/api/campaigns')">`,
  `<svg/onload=alert(1)>`,
  `<a href=javascript:alert(1)>x</a>`,
  `<a href="jav&#x61;script:alert(1)">x</a>`,
  `<a href="java\tscript:alert(1)">x</a>`,
  `<iframe srcdoc="<script>alert(1)</script>"></iframe>`,
  `<script>alert(1)</script>`,
  `<img src=x onerror=alert(1)//>`,
  `<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>`,
  `<form action="javascript:alert(1)"><button>x</button></form>`,
  `<object data="javascript:alert(1)"></object>`,
  `<embed src="javascript:alert(1)">`,
  `<a href="data:text/html,<script>alert(1)</script>">x</a>`,
  `<a href="vbscript:msgbox(1)">x</a>`,
  `<div style="background:url(javascript:alert(1))">x</div>`,
  `<div style="width:expression(alert(1))">x</div>`,
  `<style>body{display:none}</style>`,
  `<details open ontoggle=alert(1)>`,
  `<body onload=alert(1)>`,
  `<input autofocus onfocus=alert(1)>`,
];

function assertInert(html: string) {
  const lower = html.toLowerCase();
  expect(lower).not.toMatch(/<script|<iframe|<svg|<object|<embed|<form|<style|<input|<math/);
  expect(lower).not.toMatch(/\son[a-z]+\s*=/);
  expect(lower).not.toMatch(/javascript:|vbscript:|data:text|expression\(/);
  expect(lower).not.toContain("srcdoc");
}

describe("sanitizeEmailHtml", () => {
  it.each(XSS_PAYLOADS)("neutralises %s", (payload) => {
    assertInert(sanitizeEmailHtml(payload));
  });

  it("keeps email markup: tables, inline styles, layout attributes", () => {
    const html =
      '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center">' +
      '<tbody><tr><td valign="top" bgcolor="#ffffff" style="padding:12px;color:#333333;">' +
      '<p style="margin:0;"><strong>Hi</strong> <em>there</em></p>' +
      '<img src="https://cdn.example.com/a.png" alt="A" width="280">' +
      "</td></tr></tbody></table>";
    expect(sanitizeEmailHtml(html)).toBe(html);
  });

  it("keeps safe links and the unsubscribe placeholder", () => {
    const out = sanitizeEmailHtml(
      '<a href="https://a.com/x?y=1&amp;z=2" target="_blank">a</a>' +
        '<a href="mailto:hi@a.com">b</a><a href="tel:+15550000">c</a>' +
        '<a href="{{unsubscribe_url}}">d</a>',
    );
    expect(out).toContain('href="https://a.com/x?y=1&amp;z=2"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('href="mailto:hi@a.com"');
    expect(out).toContain('href="tel:+15550000"');
    expect(out).toContain('href="{{unsubscribe_url}}"');
  });

  it("gives a bare-domain link a scheme instead of leaving it relative", () => {
    expect(sanitizeEmailHtml('<a href="example.com/signup">x</a>')).toBe(
      '<a href="https://example.com/signup">x</a>',
    );
  });

  it("removes a link target it cannot make safe but keeps the text", () => {
    expect(sanitizeEmailHtml('<a href="/relative">keep me</a>')).toBe("<a>keep me</a>");
  });

  it("removes what could draw over the app around the canvas", () => {
    const out = sanitizeEmailHtml(
      '<div class="fixed inset-0 z-50" style="position:fixed;top:0;color:#333333;">x</div>',
    );
    expect(out).not.toContain("class=");
    expect(out).not.toMatch(/position/i);
    expect(out).toContain("color");
    expect(sanitizeEmailHtml('<p style="position:relative;">x</p>')).toBe(
      '<p style="position:relative;">x</p>',
    );
  });

  it("returns an empty string for non-strings", () => {
    expect(sanitizeEmailHtml(undefined)).toBe("");
    expect(sanitizeEmailHtml(42)).toBe("");
  });
});

describe("normalizeLinkUrl", () => {
  it.each([
    ["https://example.com", "https://example.com"],
    ["  http://example.com/a  ", "http://example.com/a"],
    ["mailto:a@b.co", "mailto:a@b.co"],
    ["tel:+15550000", "tel:+15550000"],
    ["{{unsubscribe_url}}", "{{unsubscribe_url}}"],
    ["{{ unsubscribe_url }}", "{{unsubscribe_url}}"],
    ["example.com/signup", "https://example.com/signup"],
    ["www.shop.co.uk", "https://www.shop.co.uk"],
    ["example.com:8080/x", "https://example.com:8080/x"],
    ["//cdn.example.com/a", "https://cdn.example.com/a"],
    ["hello@example.com", "mailto:hello@example.com"],
    ["#top", "#top"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeLinkUrl(input)).toBe(expected);
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "java\tscript:alert(1)",
    "\u0001javascript:alert(1)",
    "jav&#x61;script:alert(1)",
    "data:text/html,hi",
    "vbscript:x",
    "file:///etc/passwd",
    "/relative/path",
    "not a url",
    "",
    "{{first_name}}",
  ])("drops %j", (input) => {
    expect(normalizeLinkUrl(input)).toBe("");
  });

  it("drops non-strings", () => {
    expect(normalizeLinkUrl(undefined)).toBe("");
    expect(normalizeLinkUrl({})).toBe("");
  });
});

describe("normalizeImageUrl", () => {
  it("allows http(s) and fixes bare hosts", () => {
    expect(normalizeImageUrl("https://a.com/i.png")).toBe("https://a.com/i.png");
    expect(normalizeImageUrl("a.com/i.png")).toBe("https://a.com/i.png");
  });
  it("drops other schemes and relative paths", () => {
    expect(normalizeImageUrl("javascript:alert(1)")).toBe("");
    expect(normalizeImageUrl("data:image/png;base64,AAAA")).toBe("");
    expect(normalizeImageUrl("mailto:a@b.co")).toBe("");
    expect(normalizeImageUrl("/social/x.png")).toBe("");
  });
});

describe("sanitizeUrl (write-time)", () => {
  it("only removes dangerous schemes, leaving half-typed URLs alone", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeUrl(" java\nscript:alert(1)")).toBe("");
    expect(sanitizeUrl("exam")).toBe("exam");
    expect(sanitizeUrl("example.com:8080")).toBe("example.com:8080");
    expect(sanitizeUrl("mailto:a@b.co")).toBe("mailto:a@b.co");
    expect(sanitizeUrl("mailto:a@b.co", true)).toBe("");
  });
});

describe("style values", () => {
  it.each(["#fff", "#FFFFFF", "#ffffff80", "rgb(1, 2, 3)", "rgba(0,0,0,0.5)", "hsl(10 20% 30%)", "red", "transparent"])(
    "accepts colour %s",
    (color) => {
      expect(safeColor(color)).toBe(color);
    },
  );

  it.each([`red;" onmouseover="alert(1)`, "red;background:url(x)", "url(x)", "#ggg", "", "expression(alert(1))", 12])(
    "rejects colour %j",
    (color) => {
      expect(safeColor(color)).toBeUndefined();
    },
  );

  it("validates font families", () => {
    expect(safeFontFamily(`"Helvetica Neue", Arial, sans-serif`)).toBe(`"Helvetica Neue", Arial, sans-serif`);
    expect(safeFontFamily("Arial;background:url(x)")).toBeUndefined();
    expect(safeFontFamily(`Arial" onmouseover="x`)).toBeUndefined();
  });

  it("coerces and clamps numbers", () => {
    expect(safeNumber("12", 0, 0, 100)).toBe(12);
    expect(safeNumber("12px", 5, 0, 100)).toBe(5);
    expect(safeNumber(1e9, 5, 0, 100)).toBe(100);
    expect(safeNumber(Number.NaN, 5, 0, 100)).toBe(5);
  });
});

describe("sanitizeEmailDocument", () => {
  const payload = `<img src="x"/onerror="alert(1)">ok`;

  function docWith(blocks: EmailBlock[]) {
    return createDocument({ blocks });
  }

  it("sanitizes every HTML-bearing field of every block type", () => {
    const column = {
      ...createColumn(),
      heading: payload,
      body: payload,
      blocks: [{ ...createBlock("paragraph"), body: payload } as EmailBlock],
    };
    const doc = docWith([
      { ...createBlock("text"), heading: payload, body: payload } as EmailBlock,
      { ...createBlock("heading"), text: payload } as EmailBlock,
      { ...createBlock("paragraph"), body: payload } as EmailBlock,
      { ...createBlock("articleCard"), headline: payload, body: payload } as EmailBlock,
      { ...createBlock("rawHtml"), html: payload } as EmailBlock,
      { ...createBlock("columns"), columns: [column] } as EmailBlock,
    ]);

    const json = JSON.stringify(sanitizeEmailDocument(doc));
    expect(json).not.toContain("onerror");
    expect(json).toContain("ok");
  });

  it("removes dangerous URLs from every URL field", () => {
    const bad = "javascript:alert(1)";
    const doc = docWith([
      { ...createBlock("image"), src: bad, href: bad } as EmailBlock,
      { ...createBlock("button"), href: bad, secondaryLabel: "b", secondaryHref: bad } as EmailBlock,
      { ...createBlock("logo"), src: bad, href: bad } as EmailBlock,
      { ...createBlock("video"), url: bad } as EmailBlock,
      { ...createBlock("articleCard"), imageSrc: bad, linkUrl: bad } as EmailBlock,
      {
        ...createBlock("social"),
        links: [{ id: "s", platform: "custom", url: bad, iconSrc: bad }],
      } as EmailBlock,
      {
        ...createBlock("columns"),
        columns: [{ ...createColumn(), imageSrc: bad, linkUrl: bad }],
      } as EmailBlock,
    ]);
    expect(JSON.stringify(sanitizeEmailDocument(doc))).not.toContain("javascript:");
  });

  it("resets invalid style values instead of passing them through", () => {
    const doc = createDocument();
    doc.settings.backgroundColor = `red;" onmouseover="alert(1)`;
    doc.settings.fontFamily = `Arial" onmouseover="alert(1)`;
    doc.settings.padding = "24px;x" as unknown as number;
    doc.blocks = [{ ...createBlock("paragraph"), textColor: `#000" onclick="x` } as EmailBlock];

    const clean = sanitizeEmailDocument(doc);
    expect(clean.settings.backgroundColor).toBe("#f0ece8");
    expect(clean.settings.fontFamily).toBe("Arial, Helvetica, sans-serif");
    expect(clean.settings.padding).toBe(24);
    expect(clean.blocks[0].textColor).toBeUndefined();
  });

  it("keeps clean documents intact", () => {
    const doc = docWith([createBlock("text"), createBlock("button"), createBlock("columns")]);
    const clean = sanitizeEmailDocument(doc);
    expect(clean.settings).toEqual(doc.settings);
    expect(clean.blocks.map((b) => b.type)).toEqual(["text", "button", "columns"]);
    expect((clean.blocks[0] as { body: string }).body).toBe(
      (doc.blocks[0] as { body: string }).body,
    );
  });

  it("drops unknown block types and survives malformed input", () => {
    const doc = createDocument({
      blocks: [{ id: "x", type: "evil" } as unknown as EmailBlock, null as unknown as EmailBlock],
    });
    expect(sanitizeEmailDocument(doc).blocks).toEqual([]);
    expect(() => sanitizeEmailDocument({} as never)).not.toThrow();
    expect(sanitizeEmailDocument({} as never).blocks).toEqual([]);
  });
});

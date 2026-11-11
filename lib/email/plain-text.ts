// HTML → plain text for the text/plain part of every email.
//
// The text part is what a screen reader, a text-only client, or a spam filter
// reads, so it has to carry the same information as the HTML: link targets,
// list structure and paragraph breaks — not one run-on line with the URLs
// thrown away.
//
// This is a small tokenizer rather than a DOM walk because it runs in the
// compiler, on both the server and the client, and its input has already been
// through sanitizeEmailHtml() — it is turning trusted markup into text, not
// deciding what is safe.

import { normalizeLinkUrl } from "./sanitize";

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
  bull: "•",
  middot: "·",
  copy: "©",
  reg: "®",
  trade: "™",
  euro: "€",
  pound: "£",
  yen: "¥",
  cent: "¢",
  deg: "°",
  times: "×",
  rarr: "→",
  larr: "←",
  zwnj: "",
  zwj: "",
  shy: "",
};

/** Decode named and numeric character references. A non-breaking space
 *  becomes a plain space — in a text part it only causes odd wrapping. */
export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const hex = entity[1] === "x" || entity[1] === "X";
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (!Number.isFinite(code) || code < 1 || code > 0x10ffff) return match;
      return code === 0xa0 ? " " : String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Tags that start and end a paragraph. */
const BLOCK_TAGS = new Set([
  "p",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "pre",
  "table",
  "tr",
  "ul",
  "ol",
  "section",
  "article",
  "header",
  "footer",
  "center",
  "hr",
  "address",
  "figure",
  "figcaption",
]);

/** Drop these with everything inside them. */
const SKIPPED_CONTENT_RE = /<(script|style|head|title|template)\b[\s\S]*?<\/\1\s*>/gi;

const TOKEN_RE = /<!--[\s\S]*?-->|<(\/?)([a-z][a-z0-9]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
const HREF_RE = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;

/** "Label (url)", or just one of them when the other adds nothing. */
export function linkText(label: string, url: string): string {
  const text = label.trim();
  if (!url) return text;
  if (!text || text === url || `mailto:${text}` === url || `tel:${text}` === url) {
    return url;
  }
  return `${text} (${url})`;
}

type ListState = { ordered: boolean; index: number };
type LinkState = { href: string; start: number };

/**
 * Convert an HTML fragment to readable plain text:
 *   - links become "text (url)" (javascript: and other unsafe links are dropped)
 *   - list items become "- item" or "1. item"
 *   - paragraphs and other block elements are separated by a blank line
 *   - <br> is a line break, and entities (&nbsp;, &amp;, &#8217;…) are decoded
 */
export function htmlToText(html: string): string {
  if (!html) return "";
  const source = html.replace(SKIPPED_CONTENT_RE, "");

  let out = "";
  const lists: ListState[] = [];
  const links: LinkState[] = [];

  const appendText = (raw: string) => {
    const text = decodeEntities(raw.replace(/\s+/g, " "));
    if (!text) return;
    // Don't let a leading space start a line.
    out += /(^|\n)$/.test(out) ? text.replace(/^ +/, "") : text;
  };

  // Line and paragraph breaks are "at least this much", so nested wrappers
  // (<td><p>, <li><p>) don't stack up blank lines.
  const trimEnd = () => {
    out = out.replace(/[ \t]+$/, "");
  };
  const ensureLine = () => {
    trimEnd();
    if (out && !out.endsWith("\n")) out += "\n";
  };
  const ensureParagraph = () => {
    trimEnd();
    if (!out) return;
    out = out.replace(/\n*$/, "\n\n");
  };
  const indent = () => "  ".repeat(Math.max(0, lists.length - 1));
  const afterMarker = () => /(?:^|\n) *(?:-|\d+\.) $/.test(out);

  let cursor = 0;
  for (const match of source.matchAll(TOKEN_RE)) {
    appendText(source.slice(cursor, match.index));
    cursor = match.index + match[0].length;

    const tagName = match[2]?.toLowerCase();
    if (!tagName) continue; // comment
    const closing = match[1] === "/";

    if (tagName === "br") {
      trimEnd();
      out += "\n";
    } else if (tagName === "li") {
      ensureLine();
      if (!closing) {
        const list = lists[lists.length - 1];
        out += `${indent()}${list?.ordered ? `${++list.index}. ` : "- "}`;
      }
    } else if (tagName === "ul" || tagName === "ol") {
      if (closing) lists.pop();
      else lists.push({ ordered: tagName === "ol", index: 0 });
      // A nested list continues its parent item; a top-level one is its
      // own paragraph.
      if (lists.length > (closing ? 0 : 1)) ensureLine();
      else ensureParagraph();
    } else if (lists.length > 0 && BLOCK_TAGS.has(tagName)) {
      // Editors wrap list item content in <p>. The first one belongs on the
      // marker's line; any after it continue the item on a new line.
      if (!closing && !afterMarker()) {
        ensureLine();
        out += `${indent()}  `;
      }
    } else if (tagName === "a") {
      if (!closing) {
        const hrefMatch = HREF_RE.exec(match[3] ?? "");
        const rawHref = hrefMatch ? (hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3] ?? "") : "";
        const href = normalizeLinkUrl(decodeEntities(rawHref));
        links.push({ href: href.startsWith("#") ? "" : href, start: out.length });
      } else {
        const link = links.pop();
        if (link?.href) {
          const start = Math.min(link.start, out.length);
          out = out.slice(0, start) + linkText(out.slice(start), link.href);
        }
      }
    } else if (tagName === "td" || tagName === "th") {
      if (closing) out += " ";
    } else if (BLOCK_TAGS.has(tagName)) {
      ensureParagraph();
    }
  }
  appendText(source.slice(cursor));

  return tidy(out);
}

/**
 * Collapse runs of spaces inside each line, trim line ends, and allow at most
 * one blank line in a row. Leading spaces are kept: they are the indent of a
 * nested list item.
 */
export function tidy(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const indent = /^ */.exec(line)?.[0] ?? "";
      const rest = line.slice(indent.length).replace(/[ \t]+/g, " ").trimEnd();
      return rest ? indent + rest : "";
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

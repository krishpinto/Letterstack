// Normalizer for the `rawHtml` block — the one place arbitrary HTML enters an
// email. Used by the inspector's code editor and by the agent's setCustomHtml
// tool, so both surfaces get identical treatment.
//
// Three jobs:
//   1. Unwrap full documents. The compiler drops this html straight into a <td>
//      inside the email table, so a pasted <!DOCTYPE><html><head> nests a
//      document inside a table cell and most clients mangle it.
//   2. Strip anything unsafe. Once a model writes this field it is untrusted
//      input — models can be prompt-injected by content the user pasted.
//   3. Derive the plain-text alternative, which nothing was writing before.
//
// Parsing uses the browser's own DOMParser rather than regexes: it handles
// malformed markup the way a real client would, and `doc.body` gives us the
// unwrap in (1) for free. Both callers are client-side. On a server render
// there is no DOMParser, so we fail closed and report it instead of pretending
// the content was checked.

/** Removed outright — dangerous, or meaningless once inlined into an email. */
const STRIPPED_TAGS = new Set([
  "script",
  "style",
  "link",
  "meta",
  "title",
  "base",
  "iframe",
  "object",
  "embed",
  "noscript",
  "form",
  "input",
  "textarea",
  "select",
  "option",
]);

/** Kept, but flagged — renders inconsistently or not at all in email clients. */
const EMAIL_UNSAFE_TAGS = new Set(["svg", "canvas", "video", "audio", "picture"]);

const UNSAFE_URL_RE = /^\s*(javascript|vbscript|file):/i;

export type NormalizeRawHtmlResult = {
  /** Safe, unwrapped markup ready for the compiler. */
  html: string;
  /** Plain-text equivalent for the text/plain part of the email. */
  text: string;
  /** Human-readable problems. Shown in the inspector, fed back to the agent. */
  warnings: string[];
};

/**
 * CSS the email compiler's table layout can't survive. These are warned about
 * rather than rewritten — silently "fixing" someone's CSS teaches them nothing
 * and usually produces a layout they didn't ask for.
 */
function collectCssWarnings(styleValue: string, warnings: Set<string>) {
  const css = styleValue.toLowerCase();
  if (/display\s*:\s*(inline-)?flex/.test(css)) {
    warnings.add("Flexbox is not supported in Outlook — use tables for layout.");
  }
  if (/display\s*:\s*(inline-)?grid/.test(css)) {
    warnings.add("CSS grid is not supported in most email clients — use tables.");
  }
  if (/position\s*:\s*(absolute|fixed|sticky)/.test(css)) {
    warnings.add("Positioned elements are stripped by most email clients.");
  }
  if (/var\s*\(\s*--/.test(css)) {
    warnings.add("CSS variables don't resolve in email — use literal values.");
  }
}

/** Collapse runs of whitespace so the text part doesn't inherit HTML indenting. */
function tidyText(value: string): string {
  return value
    .replace(/ /g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

export function normalizeRawHtml(input: string): NormalizeRawHtmlResult {
  const source = input ?? "";

  if (typeof DOMParser === "undefined") {
    // Server render: we cannot verify this content, so don't claim we did.
    return {
      html: "",
      text: "",
      warnings: ["HTML could not be checked in this environment."],
    };
  }

  const warnings = new Set<string>();
  // parseFromString always produces a full document, so a fragment and a whole
  // <!DOCTYPE html> page both land in `body` — that is the unwrap.
  const doc = new DOMParser().parseFromString(source, "text/html");

  if (/<\s*(!doctype|html|head|body)\b/i.test(source)) {
    warnings.add(
      "Pasted a full HTML document — kept only the contents of <body>, which is what an email can use.",
    );
  }

  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  const doomed: Element[] = [];

  while (walker.nextNode()) {
    const el = walker.currentNode as Element;
    const tag = el.tagName.toLowerCase();

    if (STRIPPED_TAGS.has(tag)) {
      doomed.push(el);
      warnings.add(`Removed <${tag}>, which is not allowed in email content.`);
      continue;
    }

    if (EMAIL_UNSAFE_TAGS.has(tag)) {
      warnings.add(`<${tag}> does not render in most email clients.`);
    }

    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();

      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
        warnings.add("Removed inline event handlers (onclick and similar).");
        continue;
      }

      if ((name === "href" || name === "src") && UNSAFE_URL_RE.test(attr.value)) {
        el.removeAttribute(attr.name);
        warnings.add("Removed a script URL.");
        continue;
      }

      // Images must be hosted URLs — see the "images are external URLs" rule.
      if (name === "src" && /^\s*data:/i.test(attr.value)) {
        el.removeAttribute(attr.name);
        warnings.add("Removed a base64 image — upload it and use its URL instead.");
        continue;
      }

      if (name === "style") collectCssWarnings(attr.value, warnings);
    }
  }

  for (const el of doomed) el.remove();

  const html = doc.body.innerHTML.trim();
  const text = tidyText(doc.body.textContent ?? "");

  if (html && !text) {
    warnings.add("This block has no readable text, so it will be blank in the plain-text email.");
  }

  return { html, text, warnings: [...warnings] };
}

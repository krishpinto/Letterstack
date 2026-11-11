// Every value in an EmailDocument is untrusted. Documents arrive from the
// editor, from the agent (which can be prompt-injected by pasted content), and
// from other workspaces through shared template links — and the canvas renders
// their HTML fields inside the app's own origin, next to the user's session.
//
// This module is the one place that decides what is safe:
//   - sanitizeEmailHtml()     — DOMPurify, configured for email markup
//   - normalizeLinkUrl() and
//     normalizeImageUrl()     — the URL allow-list the compiler uses
//   - safeColor() and friends — values that get interpolated into style=""
//   - sanitizeEmailDocument() — walks every field of every block type
//
// sanitizeEmailDocument() runs on every write (templates, campaigns) and again
// inside compileEmailDocument(), so documents stored before this existed are
// cleaned on their way out too. isomorphic-dompurify uses the browser's DOM in
// the editor and jsdom on the server, so both sides run the same rules.

import DOMPurify from "isomorphic-dompurify";
import {
  initialEmailDocument,
  type ColumnContent,
  type EmailBlock,
  type EmailDocument,
  type EmailDocumentSettings,
  type SocialLink,
} from "./document";

// ─── URLs ─────────────────────────────────────────────────────────────────────

const ALLOWED_LINK_SCHEMES = new Set(["http", "https", "mailto", "tel"]);
const ALLOWED_IMAGE_SCHEMES = new Set(["http", "https"]);

/** The one merge tag that may stand in for a whole URL. */
export const UNSUBSCRIBE_PLACEHOLDER = "{{unsubscribe_url}}";
const UNSUBSCRIBE_RE = /^\{\{\s*unsubscribe_url\s*\}\}$/i;

const SCHEME_RE = /^([a-z][a-z0-9+.-]*):/i;
// "example.com/signup", "www.shop.co.uk", "example.com:8080/x"
const BARE_HOST_RE =
  /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}(?::\d{1,5})?(?:[/?#]|$)/i;
const EMAIL_RE = /^[^\s@/:?#]+@[^\s@/:?#]+\.[a-z]{2,63}$/i;

/**
 * Browsers drop tabs and newlines anywhere in a URL, and leading control
 * characters and spaces, before they look at the scheme. "java\tscript:" is
 * javascript:, so the scheme check has to see the URL the same way.
 */
function urlProbe(value: string): string {
  return value.replace(/[\t\n\r]/g, "").replace(/^[\u0000- ]+/, "");
}

/**
 * The scheme of a URL, or null when it has none. "example.com:8080/x" parses
 * as scheme "example.com" by the URL spec, but nobody means that — a dot in
 * the "scheme" or a port number after the colon means it is a host.
 */
function schemeOf(probe: string): string | null {
  const match = SCHEME_RE.exec(probe);
  if (!match) return null;
  const scheme = match[1];
  const rest = probe.slice(match[0].length);
  if (scheme.includes(".") || /^\d+(?:[/?#]|$)/.test(rest)) return null;
  return scheme.toLowerCase();
}

/**
 * Write-time URL check: removes a URL only when it is dangerous (a scheme
 * outside the allow-list, e.g. javascript: or data:). Everything else is kept
 * exactly as typed, so a save never rewrites a link the user is still editing.
 * The compiler does the full normalization at render time.
 */
export function sanitizeUrl(value: unknown, images = false): string {
  if (typeof value !== "string") return "";
  const scheme = schemeOf(urlProbe(value));
  const allowed = images ? ALLOWED_IMAGE_SCHEMES : ALLOWED_LINK_SCHEMES;
  if (scheme && !allowed.has(scheme)) return "";
  return value;
}

/**
 * Turn whatever was typed into a link field into an href a mail client can
 * follow, or "" when there is nothing safe to link to.
 *
 * Allowed: http(s), mailto, tel, "#fragment", and {{unsubscribe_url}}.
 * A bare domain ("example.com/signup") gets https:// — without it the href is
 * relative and resolves against the webmail page, which is a broken link.
 * A bare email address becomes mailto:. Anything else is dropped.
 */
export function normalizeLinkUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const url = urlProbe(value).trim();
  if (!url) return "";
  if (UNSUBSCRIBE_RE.test(url)) return UNSUBSCRIBE_PLACEHOLDER;
  if (url.startsWith("#")) return url;
  if (url.startsWith("//")) return `https:${url}`;

  const scheme = schemeOf(url);
  if (scheme) return ALLOWED_LINK_SCHEMES.has(scheme) ? url : "";
  if (EMAIL_RE.test(url)) return `mailto:${url}`;
  if (BARE_HOST_RE.test(url)) return `https://${url}`;
  return "";
}

/** Same idea for <img src>: only http(s), since a recipient's client has no
 *  origin to resolve a relative path against and blocks data: images. */
export function normalizeImageUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const url = urlProbe(value).trim();
  if (!url) return "";
  if (url.startsWith("//")) return `https:${url}`;

  const scheme = schemeOf(url);
  if (scheme) return ALLOWED_IMAGE_SCHEMES.has(scheme) ? url : "";
  if (BARE_HOST_RE.test(url)) return `https://${url}`;
  return "";
}

// ─── Style values ─────────────────────────────────────────────────────────────
// These end up inside style="…" in the compiled email. Escaping alone stops an
// attribute break-out, but not `red;background:url(…)` — so each one must also
// *be* the kind of value it claims to be.

const HEX_COLOR_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNCTION_COLOR_RE = /^(?:rgba?|hsla?)\(\s*[-+\d.%\s,/]+\)$/i;
const NAMED_COLOR_RE = /^[a-z]{3,32}$/i;

/** A hex, rgb()/rgba()/hsl()/hsla() or named colour, or undefined. */
export function safeColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const color = value.trim();
  if (
    HEX_COLOR_RE.test(color) ||
    FUNCTION_COLOR_RE.test(color) ||
    NAMED_COLOR_RE.test(color)
  ) {
    return color;
  }
  return undefined;
}

const FONT_FAMILY_RE = /^[a-z0-9 ,'"._-]{1,200}$/i;

/** A font-family list: names, quotes, commas. No `;`, `(` or `:`. */
export function safeFontFamily(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const font = value.trim();
  return FONT_FAMILY_RE.test(font) ? font : undefined;
}

/** A finite number inside [min, max], or the fallback. Numeric strings count. */
export function safeNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

// ─── HTML ─────────────────────────────────────────────────────────────────────

/**
 * Email markup is tables, inline styles and basic formatting, so DOMPurify's
 * HTML profile (no SVG, no MathML) is the starting point. On top of that:
 * nothing that submits, embeds or restyles the page around it.
 */
const FORBIDDEN_TAGS = [
  "style",
  "link",
  "meta",
  "base",
  "title",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "applet",
  "portal",
  "noscript",
  "template",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "option",
  "optgroup",
  "fieldset",
];

// DOMPurify runs every attribute value — `align="center"`, `width="600"` as
// much as `href` — through this. It is DOMPurify's default minus the schemes
// email has no use for: a value must either start with an allowed scheme, or
// not start with a scheme at all.
const ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

const DANGEROUS_CSS_RE = /expression\s*\(|javascript:|vbscript:|behavior\s*:|-moz-binding|@import/i;

// The canvas shows this markup inside the app itself, so anything that lets it
// escape its block and draw over the app's own UI is out too: `class` would
// reach the app's stylesheet ("fixed inset-0 z-50"), and positioned elements
// can cover the page. Neither does anything useful in an email — there is no
// <style> for a class to match, and mail clients strip position.
const PURIFY_CONFIG = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: FORBIDDEN_TAGS,
  FORBID_ATTR: ["srcdoc", "formaction", "action", "ping", "class"],
  ADD_ATTR: ["target"],
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP,
};

// DOMPurify hooks are global to its instance, and in the browser that instance
// is shared with other libraries (mermaid uses it). The flag scopes these hooks
// to calls made from here; sanitize() is synchronous, so it cannot leak.
let emailSanitizeActive = false;

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (!emailSanitizeActive) return;
  const el = node as Element;
  if (typeof el.getAttribute !== "function") return;

  const style = el.getAttribute("style");
  if (style && DANGEROUS_CSS_RE.test(style)) el.removeAttribute("style");

  // Read position through the parsed style, not the attribute text: CSS
  // escapes and comments ("p\osition", "position/**/:") would get past a
  // regex but not past the browser's own parser.
  const css = (el as HTMLElement).style;
  if (css && /^(?:fixed|absolute|sticky)$/i.test(css.getPropertyValue("position").trim())) {
    css.removeProperty("position");
  }

  // Same link rules as the block fields: a bare "example.com" in a rich-text
  // link would otherwise resolve against the reader's webmail page.
  if (el.tagName === "A" && el.hasAttribute("href")) {
    const href = normalizeLinkUrl(el.getAttribute("href"));
    if (href) el.setAttribute("href", href);
    else el.removeAttribute("href");
  }
});

/**
 * Sanitize an HTML fragment for use in an email and in the editor canvas.
 * Removes scripts, event handlers, iframes/objects/embeds/forms, <style>,
 * SVG/MathML, class attributes, positioned elements, and any URL outside
 * http(s)/mailto/tel.
 */
export function sanitizeEmailHtml(html: unknown): string {
  if (typeof html !== "string" || !html) return "";
  emailSanitizeActive = true;
  try {
    return String(DOMPurify.sanitize(html, PURIFY_CONFIG));
  } finally {
    emailSanitizeActive = false;
  }
}

// ─── Documents ────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: EmailDocumentSettings = initialEmailDocument.settings;

const COLOR_SETTINGS = [
  "backgroundColor",
  "contentColor",
  "accentColor",
  "linkColor",
  "textColor",
  "shadowColor",
  "buttonBackgroundColor",
  "buttonTextColor",
  "secondaryButtonBackgroundColor",
  "secondaryButtonTextColor",
] as const;

/** [min, max] for each numeric setting — wider than the sliders allow, so a
 *  value the UI can produce is never changed; only nonsense is. */
const NUMBER_SETTINGS: Record<string, [number, number]> = {
  maxWidth: [320, 1200],
  padding: [0, 120],
  radius: [0, 100],
  shadowOpacity: [0, 100],
  shadowBlur: [0, 200],
  shadowSpread: [-100, 100],
  shadowOffsetX: [-200, 200],
  shadowOffsetY: [-200, 200],
  buttonRadius: [0, 100],
  buttonPaddingY: [0, 100],
  buttonPaddingX: [0, 200],
  buttonFontSize: [8, 72],
};

function sanitizeSettings(raw: unknown): EmailDocumentSettings {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const settings = { ...DEFAULT_SETTINGS } as Record<string, unknown>;

  for (const key of COLOR_SETTINGS) {
    settings[key] = safeColor(input[key]) ?? DEFAULT_SETTINGS[key];
  }
  for (const [key, [min, max]] of Object.entries(NUMBER_SETTINGS)) {
    const fallback = DEFAULT_SETTINGS[key as keyof EmailDocumentSettings] as number;
    settings[key] = safeNumber(input[key], fallback, min, max);
  }
  settings.fontFamily = safeFontFamily(input.fontFamily) ?? DEFAULT_SETTINGS.fontFamily;
  settings.previewText = text(input.previewText);
  settings.shadowEnabled =
    typeof input.shadowEnabled === "boolean"
      ? input.shadowEnabled
      : DEFAULT_SETTINGS.shadowEnabled;

  return settings as EmailDocumentSettings;
}

const ALIGNS = ["left", "center", "right"] as const;
const BUTTON_VARIANTS = ["primary", "secondary"] as const;

function sanitizeColumn(raw: unknown): ColumnContent {
  const column = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    ...(column as Partial<ColumnContent>),
    id: text(column.id),
    width: safeNumber(column.width, 1, 0.1, 100),
    eyebrow: text(column.eyebrow),
    heading: sanitizeEmailHtml(column.heading),
    body: sanitizeEmailHtml(column.body),
    imageSrc: sanitizeUrl(column.imageSrc, true),
    imageAlt: text(column.imageAlt),
    linkLabel: text(column.linkLabel),
    linkUrl: sanitizeUrl(column.linkUrl),
    showImage: Boolean(column.showImage),
    showCta: Boolean(column.showCta),
    // Older documents kept real blocks inside columns; the editor still
    // carries them, so they are cleaned like any other block.
    blocks: Array.isArray(column.blocks)
      ? column.blocks.map(sanitizeBlock).filter((b): b is EmailBlock => b !== null)
      : [],
  };
}

function sanitizeSocialLink(raw: unknown): SocialLink {
  const link = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    ...(link as Partial<SocialLink>),
    id: text(link.id),
    platform: text(link.platform) as SocialLink["platform"],
    url: sanitizeUrl(link.url),
    iconSrc: link.iconSrc === undefined ? undefined : sanitizeUrl(link.iconSrc, true),
    label: optionalText(link.label),
  };
}

/**
 * Clean one block: HTML fields through DOMPurify, URL fields through the
 * scheme allow-list, colours/numbers/enums validated. Unknown block types are
 * dropped (null) — the compiler has nothing to render for them.
 */
export function sanitizeBlock(raw: unknown): EmailBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const block = raw as Record<string, unknown>;

  const base = {
    id: text(block.id),
    backgroundColor: safeColor(block.backgroundColor),
    textColor: safeColor(block.textColor),
    paddingTop:
      block.paddingTop === undefined ? undefined : safeNumber(block.paddingTop, 0, 0, 400),
    paddingBottom:
      block.paddingBottom === undefined ? undefined : safeNumber(block.paddingBottom, 0, 0, 400),
  };
  const align = oneOf(block.align, ALIGNS, "left");

  switch (block.type) {
    case "text":
      return {
        ...block,
        ...base,
        type: "text",
        eyebrow: optionalText(block.eyebrow),
        heading: sanitizeEmailHtml(block.heading),
        body: sanitizeEmailHtml(block.body),
        align,
      };
    case "heading":
      return {
        ...block,
        ...base,
        type: "heading",
        text: sanitizeEmailHtml(block.text),
        level: Number(block.level) === 1 ? 1 : Number(block.level) === 3 ? 3 : 2,
        align,
      };
    case "paragraph":
      return { ...block, ...base, type: "paragraph", body: sanitizeEmailHtml(block.body), align };
    case "image":
      return {
        ...block,
        ...base,
        type: "image",
        src: sanitizeUrl(block.src, true),
        alt: text(block.alt),
        width: safeNumber(block.width, 100, 1, 100),
        href: block.href === undefined ? undefined : sanitizeUrl(block.href),
      };
    case "button":
      return {
        ...block,
        ...base,
        type: "button",
        label: text(block.label),
        href: sanitizeUrl(block.href),
        align,
        variant: oneOf(block.variant, BUTTON_VARIANTS, "primary"),
        fullWidth: typeof block.fullWidth === "boolean" ? block.fullWidth : undefined,
        secondaryLabel: optionalText(block.secondaryLabel),
        secondaryHref:
          block.secondaryHref === undefined ? undefined : sanitizeUrl(block.secondaryHref),
        secondaryVariant:
          block.secondaryVariant === undefined
            ? undefined
            : oneOf(block.secondaryVariant, BUTTON_VARIANTS, "secondary"),
      };
    case "divider":
      return { ...block, ...base, type: "divider" };
    case "spacer":
      return { ...block, ...base, type: "spacer", height: safeNumber(block.height, 24, 0, 400) };
    case "columns":
      return {
        ...block,
        ...base,
        type: "columns",
        columns: Array.isArray(block.columns) ? block.columns.map(sanitizeColumn) : [],
        gap: safeNumber(block.gap, 12, 0, 100),
        columnBackgroundColor: safeColor(block.columnBackgroundColor),
        borderStyle: oneOf(block.borderStyle, ["none", "solid", "dashed", "dotted"] as const, "none"),
        borderColor: safeColor(block.borderColor) ?? "#e5e5e5",
        borderRadius: safeNumber(block.borderRadius, 6, 0, 100),
        valign: oneOf(block.valign, ["top", "middle", "bottom"] as const, "top"),
        mobile: oneOf(block.mobile, ["stack", "stack-reverse", "row"] as const, "stack"),
        cellPadding: safeNumber(block.cellPadding, 12, 0, 100),
      };
    case "articleCard":
      return {
        ...block,
        ...base,
        type: "articleCard",
        headline: sanitizeEmailHtml(block.headline),
        body: sanitizeEmailHtml(block.body),
        imageSrc: sanitizeUrl(block.imageSrc, true),
        imageAlt: text(block.imageAlt),
        imagePosition: oneOf(block.imagePosition, ["left", "right"] as const, "right"),
        showCta: typeof block.showCta === "boolean" ? block.showCta : Boolean(block.linkUrl),
        ctaStyle: oneOf(block.ctaStyle, ["link", "button"] as const, "link"),
        linkUrl: sanitizeUrl(block.linkUrl),
        linkLabel: text(block.linkLabel),
      };
    case "rawHtml":
      return {
        ...block,
        ...base,
        type: "rawHtml",
        label: text(block.label),
        html: sanitizeEmailHtml(block.html),
        text: text(block.text),
      };
    case "video":
      return { ...block, ...base, type: "video", url: sanitizeUrl(block.url), caption: text(block.caption) };
    case "social":
      return {
        ...block,
        ...base,
        type: "social",
        links: Array.isArray(block.links) ? block.links.map(sanitizeSocialLink) : [],
        align: oneOf(block.align, ALIGNS, "center"),
      };
    case "logo":
      return {
        ...block,
        ...base,
        type: "logo",
        src: sanitizeUrl(block.src, true),
        alt: text(block.alt),
        // A percentage, but the starter templates use 120 (capped by the
        // logo's 200px max-width) — keep what they render with.
        width: safeNumber(block.width, 40, 1, 400),
        align: oneOf(block.align, ALIGNS, "center"),
        href: block.href === undefined ? undefined : sanitizeUrl(block.href),
      };
    case "footer":
      return {
        ...block,
        ...base,
        type: "footer",
        companyName: text(block.companyName),
        address: text(block.address),
      };
    default:
      return null;
  }
}

/**
 * A safe copy of `document`: every HTML-bearing field of every block sanitized,
 * every URL checked against the scheme allow-list, every style value validated.
 * Never throws on malformed input — it is called on request bodies.
 */
export function sanitizeEmailDocument(document: EmailDocument): EmailDocument {
  const doc = (document && typeof document === "object" ? document : {}) as Record<string, unknown>;
  return {
    ...(doc as Partial<EmailDocument>),
    id: text(doc.id),
    name: text(doc.name),
    subject: text(doc.subject),
    fromName: text(doc.fromName),
    fromEmail: text(doc.fromEmail),
    updatedAt: text(doc.updatedAt),
    settings: sanitizeSettings(doc.settings),
    blocks: Array.isArray(doc.blocks)
      ? doc.blocks.map(sanitizeBlock).filter((b): b is EmailBlock => b !== null)
      : [],
  };
}

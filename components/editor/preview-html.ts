const SCRIPT_TAG_RE = /<script\b[\s\S]*?<\/script>/gi;
const OPEN_SCRIPT_TAG_RE = /<script\b[^>]*>/gi;
const EVENT_HANDLER_RE = /\son\w+=(["']).*?\1/gi;
const BARE_EVENT_HANDLER_RE = /\son\w+=[^\s>]+/gi;
const JS_URL_RE = /\s(href|src)=(["'])\s*javascript:[\s\S]*?\2/gi;

export function sanitizePreviewHtml(html: string): string {
  return html
    .replace(SCRIPT_TAG_RE, "")
    .replace(OPEN_SCRIPT_TAG_RE, "")
    .replace(EVENT_HANDLER_RE, "")
    .replace(BARE_EVENT_HANDLER_RE, "")
    .replace(JS_URL_RE, "");
}

export function previewHtml(html: string) {
  return { __html: sanitizePreviewHtml(html) };
}

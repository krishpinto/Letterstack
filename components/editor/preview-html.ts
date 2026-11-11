import { sanitizeEmailHtml } from "@/lib/email/sanitize";

// The canvas renders block HTML inside the app's own origin, next to the
// user's session, and that HTML can come from anyone: a shared template, the
// agent, a paste. It goes through the same DOMPurify rules as the compiler —
// a regex cannot keep up with what a browser will parse as markup.

export function sanitizePreviewHtml(html: string): string {
  return sanitizeEmailHtml(html);
}

export function previewHtml(html: string) {
  return { __html: sanitizePreviewHtml(html) };
}

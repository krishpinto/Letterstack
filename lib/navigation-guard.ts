// Which link clicks leave the current page, for the unsaved-changes guard
// (hooks/use-unsaved-changes-guard.ts). Pure so the rules can be tested
// without a browser.

export type ClickInfo = {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
};

export type AnchorInfo = {
  /** The resolved absolute URL (HTMLAnchorElement.href). */
  href: string;
  target: string;
  hasDownload: boolean;
};

/**
 * True when this click on this link would navigate the current tab to a
 * different page, which is when unsaved work would be lost. New-tab clicks
 * (modifier keys, middle button, target=_blank), downloads, and links that
 * only change the #hash leave the page in place, so they are not guarded.
 */
export function leavesPage(click: ClickInfo, anchor: AnchorInfo, currentHref: string): boolean {
  if (click.defaultPrevented || click.button !== 0) return false;
  if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return false;
  if (anchor.hasDownload) return false;
  if (anchor.target && anchor.target !== "_self") return false;

  let next: URL;
  let current: URL;
  try {
    next = new URL(anchor.href, currentHref);
    current = new URL(currentHref);
  } catch {
    return false;
  }
  if (next.protocol !== "http:" && next.protocol !== "https:") return false;
  return (
    next.origin !== current.origin ||
    next.pathname !== current.pathname ||
    next.search !== current.search
  );
}

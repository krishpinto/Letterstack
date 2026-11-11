// The script served at /embed/<key>. A customer drops
//   <script src="https://letterstack.site/embed/<key>" async></script>
// onto their site and this script renders the form the way its type promises,
// matching the hosted /s/<key> page and the dashboard previews:
//
//   static   → inline, where the script tag sits
//   popup    → a modal over the page after a short delay
//   animated → a panel that slides into the bottom-right corner
//
// Popup and slide-in also open when the visitor clicks any element with
// data-letterstack-open="<key>", so a site can wire its own "Subscribe"
// button. Once dismissed they stay closed for a week, and never open on their
// own again after the visitor subscribes (remembered in localStorage).
//
// Safety on someone else's page:
//   - Every value from the form's settings is set with textContent or as a
//     CSS custom property, never parsed as HTML, so a form's own wording
//     can't inject markup into the host page.
//   - The widget renders inside a shadow root, so the host page's CSS can't
//     restyle it and its CSS can't leak out. Browsers without shadow DOM get
//     the same markup with lsf- prefixed classes.
//   - No external CSS, fonts or scripts.

import type { FormType } from "@/db/signup-forms";
import type { WidgetConfig } from "./widget";

export type EmbedPresentation =
  | { mode: "inline" }
  | {
      mode: "modal" | "corner";
      /** How long after load it opens on its own. */
      openDelayMs: number;
      /** How long a dismissal keeps it from opening on its own again. */
      snoozeMs: number;
    };

const DAY_MS = 24 * 60 * 60 * 1000;

/** How each form type behaves on the host page. */
export function embedPresentation(formType: FormType): EmbedPresentation {
  switch (formType) {
    case "popup":
      // Long enough for the visitor to see the page they came for first.
      return { mode: "modal", openDelayMs: 4_000, snoozeMs: 7 * DAY_MS };
    case "animated":
      return { mode: "corner", openDelayMs: 2_000, snoozeMs: 7 * DAY_MS };
    default:
      return { mode: "inline" };
  }
}

/**
 * Serialize the config for a JavaScript source file. JSON is valid JS; "<" is
 * escaped as well so the output stays inert even if someone pastes the
 * script inline into an HTML <script> block.
 */
export function embedConfigLiteral(config: WidgetConfig): string {
  return JSON.stringify({
    ...config,
    presentation: embedPresentation(config.formType),
  })
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** Static CSS for the widget. Per-form values arrive as custom properties. */
const CSS = `
:host{all:initial}
.lsf-root{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:var(--lsf-text);max-width:460px;box-sizing:border-box;text-align:left;line-height:normal}
.lsf-root *,.lsf-root *::before,.lsf-root *::after{box-sizing:border-box}
.lsf-card{max-width:440px;border:1px solid var(--lsf-border);border-radius:16px;padding:20px;background:var(--lsf-bg)}
.lsf-title{font-size:17px;font-weight:700;margin:0 0 4px;line-height:1.3}
.lsf-desc{font-size:14px;color:var(--lsf-muted);margin:0 0 14px;line-height:1.5}
.lsf-form{position:relative;display:flex;flex-direction:column;gap:10px;margin:0}
.lsf-row{display:flex;gap:8px}
.lsf-input{display:block;width:100%;height:44px;margin:0;padding:0 12px;font:inherit;font-size:14px;border:1px solid var(--lsf-input-border);border-radius:var(--lsf-radius);background:var(--lsf-input-bg);color:var(--lsf-text);outline:none}
.lsf-row .lsf-input{flex:1;min-width:0}
.lsf-input:focus-visible{outline:2px solid var(--lsf-accent);outline-offset:1px}
.lsf-button{height:44px;margin:0;padding:0 18px;border:0;border-radius:var(--lsf-radius);background:var(--lsf-accent);color:#fff;font:inherit;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap}
.lsf-button:disabled{opacity:.7;cursor:default}
.lsf-button:focus-visible,.lsf-close:focus-visible{outline:2px solid var(--lsf-text);outline-offset:2px}
.lsf-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}
.lsf-msg{font-size:13px;line-height:1.5;color:#dc2626}
.lsf-msg:empty{display:none}
.lsf-done{font-size:14px;line-height:1.5}
.lsf-overlay{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.45);animation:lsf-fade .25s ease-out}
.lsf-panel{position:relative;width:100%;max-width:448px;animation:lsf-pop .3s cubic-bezier(.16,1,.3,1)}
.lsf-corner{position:fixed;right:20px;bottom:20px;z-index:2147483646;width:380px;max-width:calc(100vw - 40px);animation:lsf-slide .45s cubic-bezier(.16,1,.3,1)}
.lsf-surface{background:var(--lsf-bg);border:1px solid var(--lsf-border);border-radius:16px;padding:24px}
.lsf-raised{box-shadow:0 20px 25px -5px rgba(0,0,0,.12),0 8px 10px -6px rgba(0,0,0,.12)}
.lsf-overlay .lsf-root,.lsf-corner .lsf-root{max-width:none}
.lsf-close{position:absolute;right:-10px;top:-10px;z-index:1;display:flex;align-items:center;justify-content:center;width:28px;height:28px;margin:0;padding:0;border:1px solid var(--lsf-border);border-radius:9999px;background:var(--lsf-bg);color:var(--lsf-muted);font:inherit;font-size:14px;line-height:1;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.08)}
@keyframes lsf-fade{from{opacity:0}to{opacity:1}}
@keyframes lsf-pop{from{opacity:0;transform:translateY(8px) scale(.92)}to{opacity:1;transform:none}}
@keyframes lsf-slide{from{opacity:0;transform:translateY(32px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.lsf-overlay,.lsf-panel,.lsf-corner{animation:none}}
`;

/** The full script for one form. */
export function buildEmbedScript(config: WidgetConfig): string {
  return `(function () {
  "use strict";
  var CFG = ${embedConfigLiteral(config)};
  var CSS = ${JSON.stringify(CSS)};
  var P = CFG.presentation;
  var C = CFG.colors;
  var script = document.currentScript;

  // One instance per form per page, even if the tag is pasted twice.
  var registry = (window.__letterstackForms = window.__letterstackForms || {});
  if (registry[CFG.key]) return;
  registry[CFG.key] = true;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // ── Remembered state (dismissed / subscribed) ─────────────────────────
  var STORE = "letterstack:form:" + CFG.key;
  function readMemory() {
    try { return JSON.parse(window.localStorage.getItem(STORE) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function remember(field) {
    try {
      var memory = readMemory();
      memory[field] = Date.now();
      window.localStorage.setItem(STORE, JSON.stringify(memory));
    } catch (e) { /* storage blocked: it just opens again next visit */ }
  }
  function mayOpenOnItsOwn() {
    var memory = readMemory();
    if (memory.subscribedAt) return false;
    return !(memory.dismissedAt && Date.now() - memory.dismissedAt < P.snoozeMs);
  }

  // ── Host element + shadow root ────────────────────────────────────────
  function mountHost() {
    var host = document.createElement("div");
    host.setAttribute("data-letterstack-form", CFG.key);
    var vars = {
      "--lsf-text": C.text, "--lsf-muted": C.muted, "--lsf-bg": C.bg,
      "--lsf-border": C.border, "--lsf-input-bg": C.inputBg,
      "--lsf-input-border": C.inputBorder, "--lsf-accent": CFG.accentColor,
      "--lsf-radius": CFG.radius + "px"
    };
    for (var name in vars) host.style.setProperty(name, vars[name]);
    var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    var style = document.createElement("style");
    style.textContent = CSS;
    root.appendChild(style);
    return { host: host, root: root };
  }

  // ── The form itself ───────────────────────────────────────────────────
  function buildForm(onSubscribed) {
    var wrap = el("div", "lsf-root" + (CFG.layout === "card" ? " lsf-card" : ""));
    var title = el("div", "lsf-title", CFG.headline);
    title.id = "lsf-title";
    wrap.appendChild(title);
    if (CFG.description) wrap.appendChild(el("div", "lsf-desc", CFG.description));

    var form = el("form", "lsf-form");

    // Honeypot — off-screen, only bots fill it.
    var hp = el("input", "lsf-hp");
    hp.type = "text";
    hp.name = "website";
    hp.tabIndex = -1;
    hp.setAttribute("autocomplete", "off");
    hp.setAttribute("aria-hidden", "true");
    form.appendChild(hp);

    var nameInput = null;
    if (CFG.collectName) {
      nameInput = el("input", "lsf-input");
      nameInput.type = "text";
      nameInput.name = "name";
      nameInput.placeholder = "Your name";
      nameInput.setAttribute("aria-label", "Your name");
      nameInput.setAttribute("autocomplete", "name");
      form.appendChild(nameInput);
    }

    var email = el("input", "lsf-input");
    email.type = "email";
    email.name = "email";
    email.required = true;
    email.placeholder = "you@example.com";
    email.setAttribute("aria-label", "Email address");
    email.setAttribute("autocomplete", "email");

    var button = el("button", "lsf-button", CFG.buttonLabel);
    button.type = "submit";

    if (CFG.layout === "inline") {
      var row = el("div", "lsf-row");
      row.appendChild(email);
      row.appendChild(button);
      form.appendChild(row);
    } else {
      form.appendChild(email);
      form.appendChild(button);
    }

    var message = el("div", "lsf-msg");
    message.setAttribute("role", "alert");
    form.appendChild(message);

    function fail(text) {
      message.textContent = text;
      button.disabled = false;
      button.textContent = CFG.buttonLabel;
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (hp.value) return;
      message.textContent = "";
      button.disabled = true;
      button.textContent = "Submitting…";
      fetch(CFG.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: CFG.key,
          email: email.value,
          name: nameInput ? nameInput.value : undefined
        })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && data.ok) {
            form.style.display = "none";
            var done = el("div", "lsf-done", CFG.successMessage);
            done.setAttribute("role", "status");
            wrap.appendChild(done);
            onSubscribed();
          } else {
            fail((data && data.error) || "Something went wrong. Please try again.");
          }
        })
        .catch(function () { fail("Could not reach the server. Please try again."); });
    });

    wrap.appendChild(form);
    return { node: wrap, firstField: nameInput || email };
  }

  // ── Static: inline where the tag sits ─────────────────────────────────
  if (P.mode === "inline") {
    var inline = mountHost();
    inline.root.appendChild(buildForm(function () {}).node);
    if (script && script.parentNode) script.parentNode.insertBefore(inline.host, script);
    else (document.body || document.documentElement).appendChild(inline.host);
    return;
  }

  // ── Popup (modal) and slide-in (corner panel) ─────────────────────────
  var MODAL = P.mode === "modal";
  var mounted = null;
  var lastFocus = null;

  function focusables() {
    var list = mounted.container.querySelectorAll("input, button");
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var node = list[i];
      // Skips the honeypot (tabIndex -1) and the form once it is hidden.
      if (node.disabled || node.tabIndex < 0 || node.getClientRects().length === 0) continue;
      out.push(node);
    }
    return out;
  }

  function activeInside() {
    return mounted.root.activeElement || (mounted.host.contains(document.activeElement) ? document.activeElement : null);
  }

  function onKeyDown(event) {
    if (!mounted) return;
    if (event.key === "Escape" || event.key === "Esc") {
      if (MODAL || activeInside()) { event.preventDefault(); close(); }
      return;
    }
    // Keep Tab inside the modal while it is open.
    if (MODAL && event.key === "Tab") {
      var items = focusables();
      if (items.length === 0) return;
      var first = items[0];
      var last = items[items.length - 1];
      var current = activeInside();
      if (event.shiftKey && (current === first || !current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || !current)) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  function close() {
    if (!mounted) return;
    remember("dismissedAt");
    document.removeEventListener("keydown", onKeyDown, true);
    mounted.host.parentNode && mounted.host.parentNode.removeChild(mounted.host);
    mounted = null;
    if (MODAL && lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    lastFocus = null;
  }

  function open(takeFocus) {
    if (mounted || !document.body) return;
    var parts = mountHost();
    var built = buildForm(function () { remember("subscribedAt"); });

    var frame = el("div", MODAL ? "lsf-panel" : "lsf-corner");
    frame.setAttribute("role", "dialog");
    frame.setAttribute("aria-labelledby", "lsf-title");
    if (MODAL) frame.setAttribute("aria-modal", "true");

    var closeButton = el("button", "lsf-close", "\\u2715");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close");
    closeButton.addEventListener("click", close);
    frame.appendChild(closeButton);

    // Card layouts draw their own box; minimal and inline get a surface so
    // they read as a panel over the page.
    if (CFG.layout === "card") {
      built.node.className += " lsf-raised";
      frame.appendChild(built.node);
    } else {
      var surface = el("div", "lsf-surface lsf-raised");
      surface.appendChild(built.node);
      frame.appendChild(surface);
    }

    var container = frame;
    if (MODAL) {
      container = el("div", "lsf-overlay");
      container.addEventListener("click", function (event) {
        if (event.target === container) close();
      });
      container.appendChild(frame);
    }
    parts.root.appendChild(container);
    document.body.appendChild(parts.host);

    mounted = { host: parts.host, root: parts.root, container: container };
    document.addEventListener("keydown", onKeyDown, true);

    if (MODAL || takeFocus) {
      lastFocus = document.activeElement;
      built.firstField.focus();
    }
  }

  // Any element with data-letterstack-open="<key>" opens it on click.
  document.addEventListener("click", function (event) {
    var target = event.target;
    var trigger = target && target.closest ? target.closest("[data-letterstack-open]") : null;
    if (!trigger || trigger.getAttribute("data-letterstack-open") !== CFG.key) return;
    event.preventDefault();
    open(true);
  });

  // Checked again when the timer fires: the visitor may have subscribed or
  // dismissed it in another tab meanwhile.
  function schedule() {
    if (!mayOpenOnItsOwn()) return;
    setTimeout(function () { if (mayOpenOnItsOwn()) open(false); }, P.openDelayMs);
  }
  if (document.body) schedule();
  else document.addEventListener("DOMContentLoaded", schedule);
})();
`;
}

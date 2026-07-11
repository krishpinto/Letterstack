// The one-line embed. A customer drops
//   <script src="https://letterstack.site/embed/<key>" async></script>
// onto their site and this returns a self-contained script that injects a
// styled subscribe form where the tag sits and POSTs to /api/public/subscribe.
//
// The form is built with DOM APIs + textContent (never innerHTML with config
// values), so a form's own wording can't inject markup into the host page. No
// external CSS/fonts — everything is inline so it renders the same anywhere.

import { NextResponse } from "next/server";
import { getSignupFormByPublicKey } from "@/db/signup-forms";
import { widgetConfig } from "@/lib/forms/widget";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const form = await getSignupFormByPublicKey(key);

  if (!form) {
    // Valid JS that logs rather than throwing, so a stale embed fails quietly.
    return new NextResponse(
      `console.error("[LetterStack] signup form not found: ${key.replace(/[^a-zA-Z0-9_-]/g, "")}");`,
      { status: 404, headers: { "Content-Type": "application/javascript; charset=utf-8" } },
    );
  }

  const script = buildEmbedScript(JSON.stringify(widgetConfig(form)));

  return new NextResponse(script, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

function buildEmbedScript(configJson: string): string {
  return `(function () {
  var CFG = ${configJson};
  var self = document.currentScript;

  function el(tag, styles, text) {
    var node = document.createElement(tag);
    if (styles) node.style.cssText = styles;
    if (text != null) node.textContent = text;
    return node;
  }

  var FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  var root = el("div",
    "max-width:420px;font-family:" + FONT + ";color:#111;box-sizing:border-box;" +
    "border:1px solid #e5e7eb;border-radius:14px;padding:20px;background:#fff;");

  root.appendChild(el("div", "font-size:17px;font-weight:700;margin:0 0 4px;", CFG.headline));
  if (CFG.description) {
    root.appendChild(el("div", "font-size:14px;color:#6b7280;margin:0 0 14px;line-height:1.5;", CFG.description));
  }

  var form = el("form", "display:flex;flex-direction:column;gap:10px;margin:0;");

  // Honeypot — visually hidden, only bots fill it.
  var hp = el("input");
  hp.type = "text";
  hp.name = "website";
  hp.tabIndex = -1;
  hp.setAttribute("autocomplete", "off");
  hp.setAttribute("aria-hidden", "true");
  hp.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;opacity:0;";
  form.appendChild(hp);

  var inputStyle = "width:100%;box-sizing:border-box;height:42px;padding:0 12px;font-size:14px;" +
    "border:1px solid #d1d5db;border-radius:9px;outline:none;font-family:" + FONT + ";";

  var nameInput = null;
  if (CFG.collectName) {
    nameInput = el("input", inputStyle);
    nameInput.type = "text";
    nameInput.name = "name";
    nameInput.placeholder = "Your name";
    form.appendChild(nameInput);
  }

  var emailInput = el("input", inputStyle);
  emailInput.type = "email";
  emailInput.name = "email";
  emailInput.required = true;
  emailInput.placeholder = "you@example.com";
  form.appendChild(emailInput);

  var button = el("button",
    "height:42px;border:0;border-radius:9px;background:" + CFG.accentColor + ";color:#fff;" +
    "font-size:14px;font-weight:600;cursor:pointer;font-family:" + FONT + ";",
    CFG.buttonLabel);
  button.type = "submit";
  form.appendChild(button);

  var message = el("div", "font-size:13px;margin-top:2px;line-height:1.5;");
  form.appendChild(message);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (hp.value) return; // honeypot tripped
    message.textContent = "";
    button.disabled = true;
    var original = button.textContent;
    button.textContent = "Submitting…";

    fetch(CFG.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: CFG.key,
        email: emailInput.value,
        name: nameInput ? nameInput.value : undefined
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.ok) {
          form.style.display = "none";
          var done = el("div", "font-size:14px;color:#111;line-height:1.5;", CFG.successMessage);
          root.appendChild(done);
        } else {
          message.style.color = "#dc2626";
          message.textContent = (data && data.error) || "Something went wrong. Please try again.";
          button.disabled = false;
          button.textContent = original;
        }
      })
      .catch(function () {
        message.style.color = "#dc2626";
        message.textContent = "Could not reach the server. Please try again.";
        button.disabled = false;
        button.textContent = original;
      });
  });

  root.appendChild(form);

  if (self && self.parentNode) self.parentNode.insertBefore(root, self);
  else document.body.appendChild(root);
})();
`;
}

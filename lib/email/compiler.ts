import type {
  ArticleCardBlock,
  ColumnContent,
  EmailBlock,
  EmailDocument,
  RawHtmlBlock,
  TextBlock,
} from "./document";

export type CompiledEmail = {
  html: string;
  text: string;
};

export function compileEmailDocument(document: EmailDocument): CompiledEmail {
  const body = document.blocks
    .map((block) => renderBlock(block, document))
    .join("");
  const previewText = escapeHtml(document.settings.previewText);

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>${escapeHtml(document.name)}</title>
  </head>
  <body style="margin:0;padding:0;background:${document.settings.backgroundColor};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${previewText}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${document.settings.backgroundColor};width:100%;">
      <tr>
        <td align="center" style="padding:${document.settings.padding}px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:${document.settings.maxWidth}px;background:${document.settings.contentColor};border-radius:${document.settings.radius}px;overflow:hidden;">
            ${body}
            <tr>
              <td style="padding:24px ${document.settings.padding}px;" align="center">
                <p style="margin:0;font-family:${document.settings.fontFamily};font-size:12px;color:#999999;line-height:1.5;">
                  You received this email because you are subscribed to updates.<br>
                  <a href="{{unsubscribe_url}}" style="color:#999999;text-decoration:underline;">Unsubscribe</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    document.subject,
    document.settings.previewText,
    "",
    compilePlainText(document),
    "",
    "To unsubscribe: {{unsubscribe_url}}",
  ]
    .filter(Boolean)
    .join("\n");

  return { html, text };
}

export function compilePlainText(document: EmailDocument) {
  return document.blocks
    .flatMap((block) => blockToText(block))
    .filter(Boolean)
    .join("\n\n");
}

function renderBlock(block: EmailBlock, document: EmailDocument) {
  const inner = renderBlockInner(block, document);
  const bg = block.backgroundColor;
  const pt = block.paddingTop ?? 0;
  const pb = block.paddingBottom ?? 0;

  if (!bg && !pt && !pb) return inner;

  const style = [
    bg ? `background:${bg};` : "",
    pt || pb ? `padding-top:${pt}px;padding-bottom:${pb}px;` : "",
  ]
    .filter(Boolean)
    .join("");

  return `
            <tr>
              <td style="${style}">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  ${inner}
                </table>
              </td>
            </tr>`;
}

function renderBlockInner(block: EmailBlock, document: EmailDocument) {
  switch (block.type) {
    case "text":
      return renderTextBlock(block, document);
    case "image":
      return `
            <tr>
              <td style="padding:0;">
                <img src="${escapeAttribute(block.src)}" width="${document.settings.maxWidth}" alt="${escapeAttribute(block.alt)}" style="display:block;width:${block.width}%;max-width:${document.settings.maxWidth}px;height:auto;border:0;">
              </td>
            </tr>`;
    case "button":
      return `
            <tr>
              <td align="${block.align}" style="padding:4px ${document.settings.padding}px 28px ${document.settings.padding}px;">
                <a href="${escapeAttribute(block.href)}" style="display:inline-block;background:${document.settings.accentColor};color:#ffffff;text-decoration:none;font-family:${document.settings.fontFamily};font-size:${document.settings.buttonFontSize}px;font-weight:700;line-height:1;padding:${document.settings.buttonPaddingY}px ${document.settings.buttonPaddingX}px;border-radius:${document.settings.buttonRadius}px;">${escapeHtml(block.label)}</a>
              </td>
            </tr>`;
    case "divider":
      return `
            <tr>
              <td style="padding:8px ${document.settings.padding}px 28px ${document.settings.padding}px;">
                <div style="height:1px;background:rgba(23,33,27,0.14);line-height:1px;font-size:1px;">&nbsp;</div>
              </td>
            </tr>`;
    case "spacer":
      return `
            <tr>
              <td style="height:${block.height}px;line-height:${block.height}px;font-size:1px;">&nbsp;</td>
            </tr>`;
    case "columns":
      return renderColumnsBlock(block.columns, document);
    case "articleCard":
      return renderArticleCardBlock(block, document);
    case "rawHtml":
      return renderRawHtmlBlock(block, document);
  }
}

function renderTextBlock(block: TextBlock, document: EmailDocument) {
  const textColor = block.textColor ?? document.settings.textColor;
  const ff = document.settings.fontFamily;
  const p = document.settings.padding;

  const eyebrow = block.eyebrow
    ? `<p style="margin:0 0 8px 0;color:${document.settings.accentColor};font-family:${ff};font-size:12px;font-weight:700;letter-spacing:0;text-transform:uppercase;">${escapeHtml(block.eyebrow)}</p>`
    : "";

  const headingHtml = stripOuterP(block.heading);
  const bodyHtml = styleBodyHtml(block.body, textColor, ff, "16px", "1.65");

  return `
            <tr>
              <td align="${block.align}" style="padding:28px ${p}px 18px ${p}px;">
                ${eyebrow}
                <h1 style="margin:0 0 12px 0;color:${textColor};font-family:${ff};font-size:30px;line-height:1.14;font-weight:800;letter-spacing:0;">${headingHtml}</h1>
                <div style="margin:0;color:${textColor};font-family:${ff};font-size:16px;line-height:1.65;">${bodyHtml}</div>
              </td>
            </tr>`;
}

function renderColumnsBlock(
  columns: ColumnContent[],
  document: EmailDocument
) {
  const tc = document.settings.textColor;
  const ff = document.settings.fontFamily;
  const p = document.settings.padding;

  return `
            <tr>
              <td style="padding:4px ${p}px 24px ${p}px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    ${columns
                      .map(
                        (column) => `
                    <td valign="top" width="${Math.floor(100 / columns.length)}%" style="padding:12px;border:1px solid rgba(23,33,27,0.1);border-radius:6px;">
                      <h2 style="margin:0 0 8px 0;color:${tc};font-family:${ff};font-size:16px;line-height:1.3;font-weight:800;">${stripOuterP(column.heading)}</h2>
                      <div style="margin:0;color:${tc};font-family:${ff};font-size:14px;line-height:1.55;">${styleBodyHtml(column.body, tc, ff, "14px", "1.55")}</div>
                    </td>`
                      )
                      .join(
                        '<td width="12" style="font-size:1px;line-height:1px;">&nbsp;</td>'
                      )}
                  </tr>
                </table>
              </td>
            </tr>`;
}

function renderArticleCardBlock(
  block: ArticleCardBlock,
  document: EmailDocument
) {
  const imageCell = `
                    <td width="40%" valign="top" style="padding:0;">
                      <img src="${escapeAttribute(block.imageSrc)}" alt="${escapeAttribute(block.imageAlt)}" width="100%" style="display:block;width:100%;height:auto;border:0;border-radius:4px;">
                    </td>`;

  const textColor = block.textColor ?? document.settings.textColor;
  const ff = document.settings.fontFamily;
  const bodyHtml = styleBodyHtml(block.body, textColor, ff, "14px", "1.6");

  const textCell = `
                    <td width="60%" valign="top" style="padding:0 0 0 ${block.imagePosition === "left" ? "16" : "0"}px;">
                      <h2 style="margin:0 0 10px 0;color:${textColor};font-family:${ff};font-size:18px;line-height:1.3;font-weight:800;">${stripOuterP(block.headline)}</h2>
                      <div style="margin:0 0 14px 0;color:${textColor};font-family:${ff};font-size:14px;line-height:1.6;">${bodyHtml}</div>
                      ${block.linkUrl ? `<a href="${escapeAttribute(block.linkUrl)}" style="color:${document.settings.accentColor};font-family:${ff};font-size:14px;font-weight:700;text-decoration:none;">${escapeHtml(block.linkLabel || "Read more")} →</a>` : ""}
                    </td>`;

  const leftCell =
    block.imagePosition === "left"
      ? `${imageCell}<td width="16" style="font-size:1px;line-height:1px;">&nbsp;</td>${textCell}`
      : `${textCell}<td width="16" style="font-size:1px;line-height:1px;">&nbsp;</td>${imageCell}`;

  return `
            <tr>
              <td style="padding:16px ${document.settings.padding}px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    ${leftCell}
                  </tr>
                </table>
              </td>
            </tr>`;
}

function renderRawHtmlBlock(block: RawHtmlBlock, document: EmailDocument) {
  return `
            <tr>
              <td style="padding:24px ${document.settings.padding}px;color:${document.settings.textColor};font-family:${document.settings.fontFamily};font-size:16px;line-height:1.6;">
                ${block.html}
              </td>
            </tr>`;
}

function blockToText(block: EmailBlock): string[] {
  switch (block.type) {
    case "text":
      return [
        block.eyebrow ?? "",
        stripHtml(block.heading),
        stripHtml(block.body),
      ];
    case "image":
      return [block.alt];
    case "button":
      return [`${block.label}: ${block.href}`];
    case "divider":
    case "spacer":
      return [];
    case "columns":
      return block.columns.flatMap((column) => [
        stripHtml(column.heading),
        stripHtml(column.body),
      ]);
    case "articleCard":
      return [
        stripHtml(block.headline),
        stripHtml(block.body),
        block.linkUrl ? `${block.linkLabel}: ${block.linkUrl}` : "",
      ];
    case "rawHtml":
      return [block.text];
  }
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

// Strip all HTML tags — used for plain-text fallback of rich-text fields
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// Remove the wrapping <p>…</p> that TipTap adds to single-line fields
function stripOuterP(html: string): string {
  const stripped = html
    .replace(/^<p[^>]*>([\s\S]*?)<\/p>\s*$/i, "$1")
    .trim();
  return stripped || html;
}

// Inject email-safe inline styles into TipTap-produced block elements.
function styleBodyHtml(
  html: string,
  color: string,
  fontFamily: string,
  fontSize: string,
  lineHeight: string
): string {
  const base = `color:${color};font-family:${fontFamily};font-size:${fontSize};line-height:${lineHeight};`;
  return html
    .replace(
      /<p(\s[^>]*)?>(?!<\/p>)/g,
      (_, a = "") => mergeStyle("p", `margin:0 0 8px 0;${base}`, a)
    )
    .replace(
      /<h2(\s[^>]*)?>(?!<\/h2>)/g,
      (_, a = "") =>
        mergeStyle(
          "h2",
          `margin:0 0 10px 0;${base}font-size:20px;font-weight:800;`,
          a
        )
    )
    .replace(
      /<h3(\s[^>]*)?>(?!<\/h3>)/g,
      (_, a = "") =>
        mergeStyle(
          "h3",
          `margin:0 0 8px 0;${base}font-size:16px;font-weight:700;`,
          a
        )
    )
    .replace(
      /<blockquote(\s[^>]*)?>(?!<\/blockquote>)/g,
      (_, a = "") =>
        mergeStyle(
          "blockquote",
          `margin:0 0 12px 0;padding:8px 12px;border-left:3px solid rgba(0,0,0,0.15);${base}`,
          a
        )
    )
    .replace(
      /<ul(\s[^>]*)?>(?!<\/ul>)/g,
      (_, a = "") =>
        mergeStyle("ul", `margin:0 0 8px 0;padding-left:20px;${base}`, a)
    )
    .replace(
      /<ol(\s[^>]*)?>(?!<\/ol>)/g,
      (_, a = "") =>
        mergeStyle("ol", `margin:0 0 8px 0;padding-left:20px;${base}`, a)
    )
    .replace(
      /<li(\s[^>]*)?>(?!<\/li>)/g,
      (_, a = "") => mergeStyle("li", `margin:0 0 4px 0;${base}`, a)
    );
}

function mergeStyle(tag: string, baseStyle: string, attrs: string): string {
  const styleMatch = attrs.match(/style="([^"]*)"/);
  if (styleMatch) {
    return `<${tag}${attrs.replace(/style="[^"]*"/, `style="${baseStyle}${styleMatch[1]}"`)}>`;
  }
  return `<${tag} style="${baseStyle}"${attrs}>`;
}

import type {
  ArticleCardBlock,
  ButtonBlock,
  ButtonVariant,
  ColumnsBlock,
  EmailBlock,
  EmailDocument,
  FooterBlock,
  HeadingBlock,
  LogoBlock,
  ParagraphBlock,
  RawHtmlBlock,
  SocialBlock,
  TextBlock,
  VideoBlock,
} from "./document";
import { getEmailContainerShadow } from "./shadow";
import { socialIconSrc, socialLabel } from "./social";

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
    <style>
      @media only screen and (max-width:480px) {
        .ls-col { display:block !important; width:100% !important; box-sizing:border-box; }
        .ls-gap { display:none !important; }
        .ls-col.ls-row { display:table-cell !important; width:auto !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:${document.settings.backgroundColor};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${previewText}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${document.settings.backgroundColor};width:100%;">
      <tr>
        <td align="center" style="padding:${document.settings.padding}px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:${document.settings.maxWidth}px;background:${document.settings.contentColor};border-radius:${document.settings.radius}px;overflow:hidden;box-shadow:${getEmailContainerShadow(document.settings)};">
            ${body}
            <tr>
              <td style="padding:24px ${document.settings.padding}px;" align="center">
                <p style="margin:0;font-family:${document.settings.fontFamily};font-size:12px;color:#999999;line-height:1.5;">
                  You received this email because you are subscribed to updates.<br>
                  <a href="{{unsubscribe_url}}" ses:no-track style="color:#999999;text-decoration:underline;">Unsubscribe</a>
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

function renderBlock(block: EmailBlock, document: EmailDocument): string {
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

function renderBlockInner(block: EmailBlock, document: EmailDocument): string {
  switch (block.type) {
    case "text":
      return renderTextBlock(block, document);
    case "heading":
      return renderHeadingBlock(block, document);
    case "paragraph":
      return renderParagraphBlock(block, document);
    case "image": {
      // Centered like the editor canvas (margin:auto for modern clients,
      // align="center" for table-based ones). The width attribute is scaled
      // to the block's percentage so Outlook doesn't stretch partial-width
      // images to the full column.
      const img = `<img src="${escapeAttribute(block.src)}" width="${Math.round((document.settings.maxWidth * block.width) / 100)}" alt="${escapeAttribute(block.alt)}" style="display:block;margin:0 auto;width:${block.width}%;max-width:${document.settings.maxWidth}px;height:auto;border:0;">`;
      const content = block.href
        ? `<a href="${escapeAttribute(block.href)}" style="display:block;text-decoration:none;">${img}</a>`
        : img;
      return `
            <tr>
              <td align="center" style="padding:0;">
                ${content}
              </td>
            </tr>`;
    }
    case "button":
      return renderButtonBlock(block, document);
    case "divider":
      return `
            <tr>
              <td style="padding:8px ${document.settings.padding}px 28px ${document.settings.padding}px;">
                <div style="height:1px;background:${block.textColor ?? document.settings.textColor};opacity:0.24;line-height:1px;font-size:1px;">&nbsp;</div>
              </td>
            </tr>`;
    case "spacer":
      return `
            <tr>
              <td style="height:${block.height}px;line-height:${block.height}px;font-size:1px;">&nbsp;</td>
            </tr>`;
    case "columns":
      return renderColumnsBlock(block, document);
    case "articleCard":
      return renderArticleCardBlock(block, document);
    case "rawHtml":
      return renderRawHtmlBlock(block, document);
    case "video":
      return renderVideoBlock(block, document);
    case "social":
      return renderSocialBlock(block, document);
    case "logo":
      return renderLogoBlock(block, document);
    case "footer":
      return renderFooterBlock(block, document);
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

function renderHeadingBlock(block: HeadingBlock, document: EmailDocument) {
  const textColor = block.textColor ?? document.settings.textColor;
  const ff = document.settings.fontFamily;
  const p = document.settings.padding;
  const sizes: Record<1 | 2 | 3, string> = { 1: "32px", 2: "24px", 3: "18px" };
  const base = `color:${textColor};font-family:${ff};font-size:${sizes[block.level]};line-height:1.2;font-weight:800;`;
  // The editor can emit multi-paragraph headings. Block-level <p> tags inside
  // an <h1> get split apart by HTML parsers (losing every inline style), so
  // render in a <div> — like the canvas does — and style inner <p>s directly.
  // stripOuterP only handles a single paragraph; leave multi-paragraph HTML
  // intact so every line keeps its wrapper.
  const paragraphCount = (block.text.match(/<p[\s>]/gi) ?? []).length;
  const source = paragraphCount > 1 ? block.text : stripOuterP(block.text);
  const text = source.replace(
    /<p(\s[^>]*)?>(?!<\/p>)/g,
    (_, attrs = "") => mergeStyle("p", `margin:0;${base}`, attrs),
  );
  return `
            <tr>
              <td align="${block.align}" style="padding:24px ${p}px 12px ${p}px;">
                <div style="margin:0;${base}">${text}</div>
              </td>
            </tr>`;
}

function renderParagraphBlock(block: ParagraphBlock, document: EmailDocument) {
  const textColor = block.textColor ?? document.settings.textColor;
  const ff = document.settings.fontFamily;
  const p = document.settings.padding;
  const bodyHtml = styleBodyHtml(block.body, textColor, ff, "16px", "1.65");
  return `
            <tr>
              <td align="${block.align}" style="padding:8px ${p}px 16px ${p}px;">
                <div style="margin:0;color:${textColor};font-family:${ff};font-size:16px;line-height:1.65;">${bodyHtml}</div>
              </td>
            </tr>`;
}

function renderVideoBlock(block: VideoBlock, document: EmailDocument) {
  const p = document.settings.padding;
  return `
            <tr>
              <td style="padding:16px ${p}px;">
                <a href="${escapeAttribute(block.url)}" style="display:block;background:#111;text-align:center;padding:48px 24px;text-decoration:none;border-radius:4px;">
                  <p style="margin:0;color:#ffffff;font-family:${document.settings.fontFamily};font-size:18px;font-weight:700;">&#9654; Watch video</p>
                </a>
                ${block.caption ? `<p style="margin:8px 0 0;color:${document.settings.textColor};font-family:${document.settings.fontFamily};font-size:13px;text-align:center;">${escapeHtml(block.caption)}</p>` : ""}
              </td>
            </tr>`;
}

/**
 * Where social icon PNGs are served from.
 *
 * Absolute, always: a recipient's mail client has no origin to resolve
 * "/social/x.png" against. On the server (the send path) APP_URL wins; in the
 * browser, where a non-public env var is simply undefined, this falls back to
 * production — which is correct, because what the preview must show is what
 * the recipient will actually load.
 */
const SOCIAL_ASSET_BASE =
  (typeof process !== "undefined" ? process.env.APP_URL : undefined) ??
  "https://letterstack.site";

function renderSocialBlock(block: SocialBlock, document: EmailDocument) {
  const p = document.settings.padding;
  // Real brand icons as images — email clients drop inline SVG and icon
  // fonts, so these are the PNGs generated by scripts/generate-social-icons.ts
  // at 2x and displayed at 32px.
  //
  // A link with no URL is dropped rather than shipped as <a href="">: the
  // canvas still shows it (it is being edited), but a dead icon in a
  // recipient's inbox helps nobody.
  const links = block.links
    .filter((link) => link.url.trim())
    .map((link) => {
      const label = escapeAttribute(socialLabel(link));
      const src = escapeAttribute(socialIconSrc(link, SOCIAL_ASSET_BASE));
      // width/height as attributes as well as CSS: Outlook sizes from the
      // attributes and ignores the style. border:0 kills its blue link ring.
      return `<a href="${escapeAttribute(link.url)}" title="${label}" style="display:inline-block;margin:0 4px;text-decoration:none;"><img src="${src}" alt="${label}" width="32" height="32" style="display:block;width:32px;height:32px;border:0;outline:none;text-decoration:none;" /></a>`;
    })
    .join("");
  return `
            <tr>
              <td align="${block.align}" style="padding:16px ${p}px;">
                ${links}
              </td>
            </tr>`;
}

function renderLogoBlock(block: LogoBlock, document: EmailDocument) {
  const p = document.settings.padding;
  if (!block.src) {
    return `<tr><td style="padding:16px ${p}px;height:60px;"></td></tr>`;
  }
  const img = `<img src="${escapeAttribute(block.src)}" alt="${escapeAttribute(block.alt)}" style="display:inline-block;width:${block.width}%;max-width:200px;height:auto;border:0;">`;
  return `
            <tr>
              <td align="${block.align}" style="padding:16px ${p}px;">
                ${block.href ? `<a href="${escapeAttribute(block.href)}" style="display:inline-block;">${img}</a>` : img}
              </td>
            </tr>`;
}

function renderFooterBlock(block: FooterBlock, document: EmailDocument) {
  const p = document.settings.padding;
  return `
            <tr>
              <td align="center" style="padding:24px ${p}px;border-top:1px solid rgba(0,0,0,0.08);">
                <p style="margin:0 0 4px 0;font-family:${document.settings.fontFamily};font-size:13px;color:#888;">© ${escapeHtml(block.companyName)}</p>
                <p style="margin:0;font-family:${document.settings.fontFamily};font-size:12px;color:#aaa;">${escapeHtml(block.address)}</p>
              </td>
            </tr>`;
}

function renderColumnsBlock(block: ColumnsBlock, document: EmailDocument): string {
  const p = document.settings.padding;
  const total = block.columns.reduce((sum, c) => sum + (c.width || 1), 0) || 1;
  const valign =
    block.valign === "middle" ? "middle" : block.valign === "bottom" ? "bottom" : "top";
  const border =
    block.borderStyle === "none"
      ? ""
      : `border:1px ${block.borderStyle} ${block.borderColor};`;
  const radius = block.borderRadius ? `border-radius:${block.borderRadius}px;` : "";
  const bg = block.columnBackgroundColor ? `background:${block.columnBackgroundColor};` : "";

  // On mobile, columns stack to full width unless the block opts to stay in a row.
  const colClass = block.mobile === "row" ? "ls-col ls-row" : "ls-col";
  const ff = document.settings.fontFamily;
  const textColor = document.settings.textColor;

  const cells = block.columns
    .map((column) => {
      const widthPct = Math.round(((column.width || 1) / total) * 1000) / 10;
      const image = column.showImage
        ? column.imageSrc
          ? `<img src="${escapeAttribute(column.imageSrc)}" alt="${escapeAttribute(column.imageAlt)}" width="100%" style="display:block;width:100%;height:auto;border:0;border-radius:${Math.max(4, block.borderRadius)}px;margin:0 0 14px 0;">`
          : `<div style="height:132px;border-radius:${Math.max(4, block.borderRadius)}px;background:#e8e8e8;color:#888;font-family:${ff};font-size:18px;font-weight:700;line-height:132px;text-align:center;margin:0 0 14px 0;">Image</div>`
        : "";
      const eyebrow = column.eyebrow
        ? `<p style="margin:0 0 6px 0;color:${document.settings.accentColor};font-family:${ff};font-size:11px;font-weight:700;letter-spacing:0;text-transform:uppercase;">${escapeHtml(column.eyebrow)}</p>`
        : "";
      const bodyHtml = styleBodyHtml(column.body, textColor, ff, "14px", "1.55");
      const cta =
        column.showCta && (column.linkLabel || column.linkUrl)
          ? `<a href="${escapeAttribute(column.linkUrl)}" style="color:${document.settings.linkColor};font-family:${ff};font-size:13px;font-weight:700;text-decoration:none;">${escapeHtml(column.linkLabel || "Learn more")} →</a>`
          : "";
      const inner = `
                        ${image}
                        ${eyebrow}
                        <h3 style="margin:0 0 8px 0;color:${textColor};font-family:${ff};font-size:18px;line-height:1.25;font-weight:800;">${stripOuterP(column.heading)}</h3>
                        <div style="margin:0 0 ${cta ? "12px" : "0"} 0;color:${textColor};font-family:${ff};font-size:14px;line-height:1.55;">${bodyHtml}</div>
                        ${cta}`;
      return `
                    <td class="${colClass}" valign="${valign}" width="${widthPct}%" style="width:${widthPct}%;vertical-align:${valign};padding:${block.cellPadding}px;${bg}${border}${radius}box-sizing:border-box;">
                      ${inner}
                    </td>`;
    })
    .join(
      `<td class="ls-gap" width="${block.gap}" style="width:${block.gap}px;font-size:1px;line-height:1px;">&nbsp;</td>`,
    );

  return `
            <tr>
              <td style="padding:4px ${p}px 24px ${p}px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    ${cells}
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
  const showCta = block.showCta ?? Boolean(block.linkUrl);
  const ctaStyle = block.ctaStyle ?? "link";
  const cta =
    showCta && (block.linkLabel || block.linkUrl)
      ? ctaStyle === "button"
        ? `<a href="${escapeAttribute(block.linkUrl)}" style="display:inline-block;background:${document.settings.buttonBackgroundColor};color:${document.settings.buttonTextColor};border:1px solid transparent;text-decoration:none;font-family:${ff};font-size:${Math.max(12, document.settings.buttonFontSize - 2)}px;font-weight:700;line-height:1;padding:${Math.max(7, document.settings.buttonPaddingY - 5)}px ${Math.max(12, document.settings.buttonPaddingX - 6)}px;border-radius:${document.settings.buttonRadius}px;">${escapeHtml(block.linkLabel || "Read more")}</a>`
        : `<a href="${escapeAttribute(block.linkUrl)}" style="color:${document.settings.linkColor};font-family:${ff};font-size:14px;font-weight:700;text-decoration:none;">${escapeHtml(block.linkLabel || "Read more")} →</a>`
      : "";

  const textCell = `
                    <td width="60%" valign="top" style="padding:0 0 0 ${block.imagePosition === "left" ? "16" : "0"}px;">
                      <h2 style="margin:0 0 10px 0;color:${textColor};font-family:${ff};font-size:18px;line-height:1.3;font-weight:800;">${stripOuterP(block.headline)}</h2>
                      <div style="margin:0 0 14px 0;color:${textColor};font-family:${ff};font-size:14px;line-height:1.6;">${bodyHtml}</div>
                      ${cta}
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
    case "heading":
      return [stripHtml(block.text)];
    case "paragraph":
      return [stripHtml(block.body)];
    case "image":
      return [block.href ? `${block.alt}: ${block.href}` : block.alt];
    case "button":
      return getButtonItems(block).map((button) => `${button.label}: ${button.href}`);
    case "divider":
    case "spacer":
      return [];
    case "columns":
      return block.columns.flatMap((column) => [
        stripHtml(column.heading),
        stripHtml(column.body),
        column.showCta ? column.linkLabel : "",
      ]);
    case "articleCard":
      return [
        stripHtml(block.headline),
        stripHtml(block.body),
        (block.showCta ?? Boolean(block.linkUrl)) && block.linkUrl
          ? `${block.linkLabel}: ${block.linkUrl}`
          : "",
      ];
    case "rawHtml":
      return [block.text];
    case "video":
      return [block.url ? `Video: ${block.url}` : ""];
    case "social":
      // Same filter as the HTML above — a link with no URL isn't in the email,
      // so it must not be in the plain-text alternative either.
      return [
        block.links
          .filter((l) => l.url.trim())
          .map((l) => `${socialLabel(l)}: ${l.url}`)
          .join(" | "),
      ];
    case "logo":
      return [block.alt];
    case "footer":
      // The compiler already appends a guaranteed unsubscribe section to every
      // email, so the footer block carries only the identity lines.
      return [block.companyName, block.address];
    default:
      return [];
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

function stripOuterP(html: string): string {
  const stripped = html
    .replace(/^<p[^>]*>([\s\S]*?)<\/p>\s*$/i, "$1")
    .trim();
  return stripped || html;
}

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

function getButtonColors(
  variant: ButtonVariant | undefined,
  document: EmailDocument,
) {
  if (variant === "secondary") {
    return {
      backgroundColor: document.settings.secondaryButtonBackgroundColor,
      color: document.settings.secondaryButtonTextColor,
    };
  }

  return {
    backgroundColor: document.settings.buttonBackgroundColor,
    color: document.settings.buttonTextColor,
  };
}

function getButtonItems(block: ButtonBlock) {
  return [
    {
      label: block.label,
      href: block.href,
      variant: block.variant ?? "primary",
    },
    block.secondaryLabel
      ? {
          label: block.secondaryLabel,
          href: block.secondaryHref ?? "",
          variant: block.secondaryVariant ?? "secondary",
        }
      : null,
  ].filter(Boolean) as {
    label: string;
    href: string;
    variant: ButtonVariant;
  }[];
}

function renderButtonBlock(block: ButtonBlock, document: EmailDocument) {
  const p = document.settings.padding;
  const full = block.fullWidth ?? false;
  const buttons = getButtonItems(block)
    .map((button) => {
      const colors = getButtonColors(button.variant, document);
      const border =
        button.variant === "secondary"
          ? `border:1px solid ${document.settings.secondaryButtonTextColor};`
          : "border:1px solid transparent;";
      // Stretched buttons become block-level and fill the column; default
      // buttons hug their label inline.
      const layout = full
        ? "display:block;width:100%;box-sizing:border-box;text-align:center;margin:0 0 8px 0;"
        : "display:inline-block;margin:0 6px 8px 0;";
      return `<a href="${escapeAttribute(button.href)}" style="${layout}background:${colors.backgroundColor};color:${colors.color};${border}text-decoration:none;font-family:${document.settings.fontFamily};font-size:${document.settings.buttonFontSize}px;font-weight:700;line-height:1;padding:${document.settings.buttonPaddingY}px ${document.settings.buttonPaddingX}px;border-radius:${document.settings.buttonRadius}px;">${escapeHtml(button.label)}</a>`;
    })
    .join("");

  return `
            <tr>
              <td align="${full ? "center" : block.align}" style="padding:4px ${p}px 12px ${p}px;">
                ${buttons}
              </td>
            </tr>`;
}

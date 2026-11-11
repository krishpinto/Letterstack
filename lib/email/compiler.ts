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
import { htmlToText, linkText } from "./plain-text";
import { normalizeImageUrl, normalizeLinkUrl, sanitizeEmailDocument } from "./sanitize";
import { getEmailContainerShadow } from "./shadow";
import { socialIconSrc, socialLabel } from "./social";

export type CompiledEmail = {
  html: string;
  text: string;
};

export function compileEmailDocument(input: EmailDocument): CompiledEmail {
  // Sanitized on every compile, not only on save: documents stored before
  // write-time sanitizing existed are still sent and previewed, and this is
  // the one function every preview and every send goes through.
  const document = withAttributeSafeStyles(
    withNormalizedUrls(sanitizeEmailDocument(input)),
  );
  const body = document.blocks
    .map((block) => renderBlock(block, document))
    .join("");
  const previewText = escapeHtml(document.settings.previewText);

  const maxWidth = document.settings.maxWidth;
  // Outlook on Windows ignores max-width, so without a fixed-width table
  // around it the content stretches to the full reading pane. The wrapper is
  // inside MSO conditional comments, so only Outlook sees it.
  const html = `<!doctype html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>${escapeHtml(document.name)}</title>
    <!--[if mso]>
    <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
    <![endif]-->
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
          <!--[if mso]><table role="presentation" align="center" width="${maxWidth}" cellspacing="0" cellpadding="0" border="0" style="width:${maxWidth}px;"><tr><td><![endif]-->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:${maxWidth}px;background:${document.settings.contentColor};border-radius:${document.settings.radius}px;overflow:hidden;box-shadow:${getEmailContainerShadow(document.settings)};">
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
          <!--[if mso]></td></tr></table><![endif]-->
        </td>
      </tr>
    </table>
  </body>
</html>`;

  // Subject and preview text as a header, then the blocks, then the
  // unsubscribe line — each section separated by a blank line. Empty
  // sections are skipped, never the blank lines between them.
  const text = joinSections([
    [document.subject, document.settings.previewText].filter(Boolean).join("\n"),
    blocksToPlainText(document),
    "To unsubscribe: {{unsubscribe_url}}",
  ]);

  return { html, text };
}

export function compilePlainText(input: EmailDocument) {
  return blocksToPlainText(withNormalizedUrls(sanitizeEmailDocument(input)));
}

function blocksToPlainText(document: EmailDocument) {
  return joinSections(document.blocks.flatMap((block) => blockToText(block)));
}

/** Non-empty sections, a blank line between each. */
function joinSections(sections: string[]): string {
  return sections
    .map((section) => section.trim())
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Turn every link and image field into a URL a mail client can use, or "".
 *
 * The editor stores URLs as typed, so this is where "example.com/signup"
 * becomes https://example.com/signup (as a bare host it would resolve
 * against the reader's webmail page) and anything outside http(s), mailto,
 * tel and {{unsubscribe_url}} is dropped. Done once, up front, so the HTML
 * and the plain-text part link to exactly the same places, and renderers
 * only have to handle "there is no link".
 */
function withNormalizedUrls(document: EmailDocument): EmailDocument {
  const blocks = document.blocks.map((block): EmailBlock => {
    switch (block.type) {
      case "image":
        return {
          ...block,
          src: normalizeImageUrl(block.src),
          href: normalizeLinkUrl(block.href) || undefined,
        };
      case "button":
        return {
          ...block,
          href: normalizeLinkUrl(block.href),
          secondaryHref: normalizeLinkUrl(block.secondaryHref),
        };
      case "columns":
        return {
          ...block,
          columns: block.columns.map((column) => ({
            ...column,
            imageSrc: normalizeImageUrl(column.imageSrc),
            linkUrl: normalizeLinkUrl(column.linkUrl),
          })),
        };
      case "articleCard":
        return {
          ...block,
          imageSrc: normalizeImageUrl(block.imageSrc),
          linkUrl: normalizeLinkUrl(block.linkUrl),
        };
      case "video":
        return { ...block, url: normalizeLinkUrl(block.url) };
      case "social":
        return {
          ...block,
          links: block.links.map((link) => ({
            ...link,
            url: normalizeLinkUrl(link.url),
            // Without a usable icon, a custom link falls back to the
            // neutral tile rather than a broken image.
            iconSrc: normalizeImageUrl(link.iconSrc) || undefined,
          })),
        };
      case "logo":
        return {
          ...block,
          src: normalizeImageUrl(block.src),
          href: normalizeLinkUrl(block.href) || undefined,
        };
      default:
        return block;
    }
  });
  return { ...document, blocks };
}

/** Width inside the content table's side padding, in pixels. */
function contentWidth(document: EmailDocument): number {
  return Math.max(1, document.settings.maxWidth - document.settings.padding * 2);
}

/** href="…" with a leading space, or nothing when there is no link. */
function hrefAttr(url: string | undefined): string {
  return url ? ` href="${escapeAttribute(url)}"` : "";
}

const BLOCK_STYLE_FIELDS = [
  "backgroundColor",
  "textColor",
  "borderColor",
  "columnBackgroundColor",
] as const;

/**
 * Colours and the font list are interpolated straight into style="…" by the
 * renderers below. sanitizeEmailDocument() has already checked that each one
 * is the kind of value it claims to be; escaping them as well means a quote
 * can never close the attribute early — and font lists legitimately contain
 * quotes ('Trebuchet MS'). Every other attribute value is escaped where it is
 * written, or is a number or an enum.
 */
function withAttributeSafeStyles(document: EmailDocument): EmailDocument {
  const settings = { ...document.settings } as Record<string, unknown>;
  for (const [key, value] of Object.entries(settings)) {
    if (key !== "previewText" && typeof value === "string") {
      settings[key] = escapeAttribute(value);
    }
  }
  const blocks = document.blocks.map((block) => {
    const copy = { ...block } as Record<string, unknown>;
    for (const key of BLOCK_STYLE_FIELDS) {
      if (typeof copy[key] === "string") copy[key] = escapeAttribute(copy[key] as string);
    }
    return copy as EmailBlock;
  });
  return {
    ...document,
    settings: settings as EmailDocument["settings"],
    blocks,
  };
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
      // No usable image URL: an <img src=""> is a broken-image icon in
      // every client, so the block is left out of the email.
      if (!block.src) return "";
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
                <a${hrefAttr(block.url)} style="display:block;background:#111;text-align:center;padding:48px 24px;text-decoration:none;border-radius:4px;">
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
    .filter((link) => link.url)
    .map((link) => {
      const label = escapeAttribute(socialLabel(link));
      const src = escapeAttribute(socialIconSrc(link, SOCIAL_ASSET_BASE));
      // width/height as attributes as well as CSS: Outlook sizes from the
      // attributes and ignores the style. border:0 kills its blue link ring.
      return `<a${hrefAttr(link.url)} title="${label}" style="display:inline-block;margin:0 4px;text-decoration:none;"><img src="${src}" alt="${label}" width="32" height="32" style="display:block;width:32px;height:32px;border:0;outline:none;text-decoration:none;" /></a>`;
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
  // Outlook sizes images from the width attribute and ignores CSS widths;
  // without one it shows the logo at its natural size. Same maths as the
  // style: a percentage of the content width, capped at 200px.
  const pixels = Math.min(200, Math.round((contentWidth(document) * block.width) / 100));
  const img = `<img src="${escapeAttribute(block.src)}" alt="${escapeAttribute(block.alt)}" width="${pixels}" style="display:inline-block;width:${block.width}%;max-width:200px;height:auto;border:0;">`;
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
  // The block's own text colour, as the canvas shows it.
  const textColor = block.textColor ?? document.settings.textColor;

  // "Reverse" stacks the last column first on mobile. The cells are written
  // in reverse order inside a dir="rtl" row, so a desktop client still lays
  // them out left to right; when the media query turns them into blocks they
  // stack in source order, which is the reversed one. Each cell sets
  // dir="ltr" back so its own text is unaffected.
  const reverse = block.mobile === "stack-reverse";
  const ordered = reverse ? [...block.columns].reverse() : block.columns;

  const cells = ordered
    .map((column) => {
      const widthPct = Math.round(((column.width || 1) / total) * 1000) / 10;
      // A numeric width for Outlook, which ignores width:100% on images and
      // would show them at natural size: the column's share of the row,
      // less the gaps, the cell padding and the border.
      const cellsWidth =
        contentWidth(document) - block.gap * Math.max(0, block.columns.length - 1);
      const imageWidth = Math.max(
        1,
        Math.floor(
          (cellsWidth * (column.width || 1)) / total -
            block.cellPadding * 2 -
            (block.borderStyle === "none" ? 0 : 2),
        ),
      );
      const image = column.showImage
        ? column.imageSrc
          ? `<img src="${escapeAttribute(column.imageSrc)}" alt="${escapeAttribute(column.imageAlt)}" width="${imageWidth}" style="display:block;width:100%;height:auto;border:0;border-radius:${Math.max(4, block.borderRadius)}px;margin:0 0 14px 0;">`
          : `<div style="height:132px;border-radius:${Math.max(4, block.borderRadius)}px;background:#e8e8e8;color:#888;font-family:${ff};font-size:18px;font-weight:700;line-height:132px;text-align:center;margin:0 0 14px 0;">Image</div>`
        : "";
      const eyebrow = column.eyebrow
        ? `<p style="margin:0 0 6px 0;color:${document.settings.accentColor};font-family:${ff};font-size:11px;font-weight:700;letter-spacing:0;text-transform:uppercase;">${escapeHtml(column.eyebrow)}</p>`
        : "";
      const bodyHtml = styleBodyHtml(column.body, textColor, ff, "14px", "1.55");
      const cta =
        column.showCta && (column.linkLabel || column.linkUrl)
          ? `<a${hrefAttr(column.linkUrl)} style="color:${document.settings.linkColor};font-family:${ff};font-size:13px;font-weight:700;text-decoration:none;">${escapeHtml(column.linkLabel || "Learn more")} →</a>`
          : "";
      const inner = `
                        ${image}
                        ${eyebrow}
                        <h3 style="margin:0 0 8px 0;color:${textColor};font-family:${ff};font-size:18px;line-height:1.25;font-weight:800;">${stripOuterP(column.heading)}</h3>
                        <div style="margin:0 0 ${cta ? "12px" : "0"} 0;color:${textColor};font-family:${ff};font-size:14px;line-height:1.55;">${bodyHtml}</div>
                        ${cta}`;
      return `
                    <td class="${colClass}"${reverse ? ' dir="ltr"' : ""} valign="${valign}" width="${widthPct}%" style="width:${widthPct}%;vertical-align:${valign};padding:${block.cellPadding}px;${bg}${border}${radius}box-sizing:border-box;">
                      ${inner}
                    </td>`;
    })
    .join(
      `<td class="ls-gap" width="${block.gap}" style="width:${block.gap}px;font-size:1px;line-height:1px;">&nbsp;</td>`,
    );

  return `
            <tr>
              <td style="padding:4px ${p}px 24px ${p}px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"${reverse ? ' dir="rtl"' : ""}>
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
  // 40% of the row beside a 16px gutter; numeric for Outlook (see columns).
  const imageWidth = Math.floor((contentWidth(document) - 16) * 0.4);
  const imageCell = `
                    <td width="40%" valign="top" style="padding:0;">
                      <img src="${escapeAttribute(block.imageSrc)}" alt="${escapeAttribute(block.imageAlt)}" width="${imageWidth}" style="display:block;width:100%;height:auto;border:0;border-radius:4px;">
                    </td>`;

  const textColor = block.textColor ?? document.settings.textColor;
  const ff = document.settings.fontFamily;
  const bodyHtml = styleBodyHtml(block.body, textColor, ff, "14px", "1.6");
  const showCta = block.showCta ?? Boolean(block.linkUrl);
  const ctaStyle = block.ctaStyle ?? "link";
  const cta =
    showCta && (block.linkLabel || block.linkUrl)
      ? ctaStyle === "button"
        ? `<a${hrefAttr(block.linkUrl)} style="display:inline-block;background:${document.settings.buttonBackgroundColor};color:${document.settings.buttonTextColor};border:1px solid transparent;text-decoration:none;font-family:${ff};font-size:${Math.max(12, document.settings.buttonFontSize - 2)}px;font-weight:700;line-height:1;padding:${Math.max(7, document.settings.buttonPaddingY - 5)}px ${Math.max(12, document.settings.buttonPaddingX - 6)}px;border-radius:${document.settings.buttonRadius}px;">${escapeHtml(block.linkLabel || "Read more")}</a>`
        : `<a${hrefAttr(block.linkUrl)} style="color:${document.settings.linkColor};font-family:${ff};font-size:14px;font-weight:700;text-decoration:none;">${escapeHtml(block.linkLabel || "Read more")} →</a>`
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
              <td style="padding:24px ${document.settings.padding}px;color:${block.textColor ?? document.settings.textColor};font-family:${document.settings.fontFamily};font-size:16px;line-height:1.6;">
                ${block.html}
              </td>
            </tr>`;
}

/**
 * The plain-text part, block by block. Rich text goes through htmlToText(),
 * so links keep their URLs ("text (url)"), lists keep their bullets and
 * paragraphs keep their breaks. URLs here are the normalized ones the HTML
 * uses, so both parts link to the same places.
 */
function blockToText(block: EmailBlock): string[] {
  switch (block.type) {
    case "text":
      return [block.eyebrow ?? "", htmlToText(block.heading), htmlToText(block.body)];
    case "heading":
      return [htmlToText(block.text)];
    case "paragraph":
      return [htmlToText(block.body)];
    case "image":
      return [block.src && block.href ? linkText(block.alt || "Image", block.href) : ""];
    case "button":
      return getButtonItems(block).map((button) => linkText(button.label, button.href));
    case "divider":
    case "spacer":
      return [];
    case "columns":
      return block.columns.map((column) =>
        joinSections([
          column.eyebrow ?? "",
          htmlToText(column.heading),
          htmlToText(column.body),
          column.showCta && (column.linkLabel || column.linkUrl)
            ? linkText(column.linkLabel || "Learn more", column.linkUrl)
            : "",
        ]),
      );
    case "articleCard":
      return [
        htmlToText(block.headline),
        htmlToText(block.body),
        (block.showCta ?? Boolean(block.linkUrl)) && (block.linkLabel || block.linkUrl)
          ? linkText(block.linkLabel || "Read more", block.linkUrl)
          : "",
      ];
    case "rawHtml":
      // Derived from the markup at send time: the stored text was a lossy
      // tag strip, and older documents may not have one at all.
      return [htmlToText(block.html) || block.text];
    case "video":
      return [block.url ? linkText(block.caption || "Watch video", block.url) : ""];
    case "social":
      // Same filter as the HTML — a link with no usable URL isn't in the
      // email, so it isn't in the plain-text part either.
      return [
        block.links
          .filter((l) => l.url)
          .map((l) => `${socialLabel(l)}: ${l.url}`)
          .join("\n"),
      ];
    case "logo":
      return [block.src && block.href ? linkText(block.alt, block.href) : ""];
    case "footer":
      // The compiler already appends a guaranteed unsubscribe section to every
      // email, so the footer block carries only the identity lines.
      return [[block.companyName, block.address].filter(Boolean).join("\n")];
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

/**
 * Buttons are table cells, not padded links. Outlook on Windows ignores
 * padding (and display:inline-block) on an <a>, which leaves a bare
 * underlined word. This is the usual hybrid: the cell carries the colour,
 * border and radius, plus mso-padding-alt so Outlook pads the cell; every
 * other client pads the link itself, so the whole button stays clickable.
 * No VML, so Outlook shows square corners.
 */
function renderButtonCell(
  button: { label: string; href: string; variant: ButtonVariant },
  document: EmailDocument,
  full: boolean,
): string {
  const s = document.settings;
  const colors = getButtonColors(button.variant, document);
  const border =
    button.variant === "secondary"
      ? `border:1px solid ${s.secondaryButtonTextColor};`
      : `border:1px solid ${colors.backgroundColor};`;
  const padding = `${s.buttonPaddingY}px ${s.buttonPaddingX}px`;
  const width = full ? ' width="100%"' : "";
  return `<td align="center" bgcolor="${colors.backgroundColor}"${width} style="background:${colors.backgroundColor};${border}border-radius:${s.buttonRadius}px;mso-padding-alt:${padding};">
                      <a${hrefAttr(button.href)} style="display:${full ? "block" : "inline-block"};padding:${padding};mso-padding-alt:0;color:${colors.color};font-family:${s.fontFamily};font-size:${s.buttonFontSize}px;font-weight:700;line-height:1;text-decoration:none;border-radius:${s.buttonRadius}px;"><span style="color:${colors.color};">${escapeHtml(button.label)}</span></a>
                    </td>`;
}

function renderButtonBlock(block: ButtonBlock, document: EmailDocument) {
  const p = document.settings.padding;
  const full = block.fullWidth ?? false;
  const cells = getButtonItems(block).map((button) =>
    renderButtonCell(button, document, full),
  );

  // Stretched buttons fill the content width, one per row, 8px apart; the
  // others sit side by side, 8px apart — the same spacing as the canvas.
  const rows = full
    ? cells
        .map((cell) => `<tr>${cell}</tr>`)
        .join(`<tr><td height="8" style="height:8px;font-size:1px;line-height:1px;">&nbsp;</td></tr>`)
    : `<tr>${cells.join(`<td width="8" style="width:8px;font-size:1px;line-height:1px;">&nbsp;</td>`)}</tr>`;

  return `
            <tr>
              <td align="${full ? "center" : block.align}" style="padding:4px ${p}px 20px ${p}px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0"${full ? ' width="100%"' : ` align="${block.align}"`} style="border-collapse:separate;${full ? "width:100%;" : ""}">
                  ${rows}
                </table>
              </td>
            </tr>`;
}

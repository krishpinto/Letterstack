"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { CodeIcon, Image01Icon, Link01Icon, Video01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import {
  DEFAULT_FONT_SIZE_BY_TEXT_TYPE,
  type FormattingTextType,
} from "./formatting-options";
import { previewHtml } from "./preview-html";
import { RichTextEditor } from "./rich-text-editor";
import {
  type ArticleCardBlock,
  type ButtonBlock,
  type ButtonVariant,
  type EmailBlock,
  type EmailDocument,
  type HeadingBlock,
  type ParagraphBlock,
  type RawHtmlBlock,
  type TextBlock,
} from "@/lib/email/document";
import { socialIconSrc, socialLabel } from "@/lib/email/social";

function stripOuterP(html: string): string {
  const stripped = html.replace(/^<p[^>]*>([\s\S]*?)<\/p>\s*$/i, "$1").trim();
  return stripped || html;
}

/** Plain-text fallback kept in sync with the HTML for the plain-text email. */
function htmlToPlain(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * The Custom HTML block's rendered preview, made directly editable. It's an
 * uncontrolled contentEditable surface: the stored HTML is pushed into the DOM
 * only when it differs from what's already there (e.g. an edit from the
 * inspector's source field), so typing here never resets the caret. `block.html`
 * stays the single source of truth — the inspector textarea and this preview are
 * two views of it, not two separate editors.
 */
function EditableHtmlBlock({
  block,
  settings,
  textColor,
  onUpdateBlock,
}: {
  block: RawHtmlBlock;
  settings: EmailDocument["settings"];
  textColor: string;
  onUpdateBlock: (updater: (b: EmailBlock) => EmailBlock) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== block.html) {
      el.innerHTML = block.html || "";
    }
  }, [block.html]);

  return (
    <div style={{ padding: `18px ${settings.padding}px` }} onClick={(e) => e.stopPropagation()}>
      <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <HugeiconsIcon icon={CodeIcon} strokeWidth={1.75} className="size-3.5" />
        {block.label || "Custom HTML"} · editable preview
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Editable HTML preview"
        onInput={(e) => {
          const html = e.currentTarget.innerHTML;
          onUpdateBlock((b) => ({ ...b, html, text: htmlToPlain(html) }) as RawHtmlBlock);
        }}
        className="min-h-[44px] rounded-md border border-dashed border-muted-foreground/30 p-3 text-sm outline-none focus:border-ring"
        style={{ color: textColor, fontFamily: settings.fontFamily }}
      />
    </div>
  );
}

function getButtonColors(
  variant: ButtonVariant | undefined,
  settings: EmailDocument["settings"],
) {
  if (variant === "secondary") {
    return {
      backgroundColor: settings.secondaryButtonBackgroundColor,
      color: settings.secondaryButtonTextColor,
    };
  }

  return {
    backgroundColor: settings.buttonBackgroundColor,
    color: settings.buttonTextColor,
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

function getHeadingTextType(level: HeadingBlock["level"]): FormattingTextType {
  return level === 1 ? "h1" : level === 2 ? "h2" : "h3";
}

export function CanvasBlockPreview({
  block,
  document,
  isSelected,
  onUpdateBlock,
}: {
  block: EmailBlock;
  document: EmailDocument;
  isSelected?: boolean;
  onUpdateBlock?: (updater: (b: EmailBlock) => EmailBlock) => void;
}) {
  const s = document.settings;
  const textColor = block.textColor ?? s.textColor;
  const editable = isSelected && !!onUpdateBlock;

  switch (block.type) {
    case "logo":
      return (
        <div style={{ padding: `16px ${s.padding}px`, textAlign: block.align }}>
          {block.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={block.src}
              alt={block.alt}
              style={{ display: "inline-block", width: `${block.width}%`, maxWidth: 200, height: "auto" }}
            />
          ) : (
            <div className="inline-flex h-12 w-32 items-center justify-center rounded border-2 border-dashed border-muted-foreground/30 text-xs text-muted-foreground">
              Your logo
            </div>
          )}
        </div>
      );

    case "image":
      return (
        <div className="relative">
          {block.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={block.src}
              alt={block.alt}
              title={block.href || undefined}
              style={{ display: "block", width: `${block.width}%`, maxWidth: "100%", height: "auto", margin: "0 auto" }}
            />
          ) : (
            <div className="flex h-40 flex-col items-center justify-center gap-2 bg-muted">
              <HugeiconsIcon icon={Image01Icon} strokeWidth={1.5} className="size-8 text-muted-foreground/40" />
              <span className="text-xs text-muted-foreground">Add an image URL in the inspector</span>
            </div>
          )}
          {block.href && block.src && (
            <span className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-foreground/70 px-2 py-0.5 text-[10px] font-medium text-background">
              <HugeiconsIcon icon={Link01Icon} strokeWidth={2} className="size-3" />
              Linked
            </span>
          )}
        </div>
      );

    case "heading":
      return (
        <div style={{ padding: `24px ${s.padding}px 12px`, textAlign: block.align, fontFamily: s.fontFamily }}>
          {editable ? (
            <RichTextEditor
              value={block.text}
              onChange={(html) => onUpdateBlock!((b) => ({ ...b, text: html }) as HeadingBlock)}
              editable
              defaultTextType={getHeadingTextType(block.level)}
              defaultFontSize={DEFAULT_FONT_SIZE_BY_TEXT_TYPE[getHeadingTextType(block.level)]}
              style={{ color: textColor, fontSize: block.level === 1 ? 32 : block.level === 2 ? 24 : 18, fontWeight: 800, lineHeight: 1.2 }}
            />
          ) : (
            <div
              className="font-extrabold leading-tight"
              style={{ color: textColor, fontSize: block.level === 1 ? 32 : block.level === 2 ? 24 : 18 }}
              dangerouslySetInnerHTML={previewHtml(stripOuterP(block.text))}
            />
          )}
        </div>
      );

    case "paragraph":
      return (
        <div style={{ padding: `8px ${s.padding}px 16px`, textAlign: block.align, fontFamily: s.fontFamily }}>
          {editable ? (
            <RichTextEditor
              value={block.body}
              onChange={(html) => onUpdateBlock!((b) => ({ ...b, body: html }) as ParagraphBlock)}
              editable
              defaultTextType="p"
              defaultFontSize={DEFAULT_FONT_SIZE_BY_TEXT_TYPE.p}
              style={{ color: textColor, fontSize: 15, lineHeight: 1.65 }}
            />
          ) : (
            <div
              className="text-[15px] leading-relaxed"
              style={{ color: textColor }}
              dangerouslySetInnerHTML={previewHtml(block.body)}
            />
          )}
        </div>
      );

    case "text":
      return (
        <div style={{ padding: `28px ${s.padding}px 18px`, textAlign: block.align, fontFamily: s.fontFamily }}>
          {(block.eyebrow || editable) && (
            editable ? (
              <textarea
                value={block.eyebrow ?? ""}
                rows={1}
                onChange={(e) =>
                  onUpdateBlock!((b) => ({ ...b, eyebrow: e.target.value }) as TextBlock)
                }
                onClick={(e) => e.stopPropagation()}
                placeholder="Eyebrow label…"
                className="mb-2 block w-full resize-none overflow-hidden bg-transparent text-[11px] font-bold uppercase tracking-wider outline-none placeholder:opacity-30"
                style={{ color: s.accentColor, borderBottom: "1px dashed currentColor" }}
              />
            ) : (
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: s.accentColor }}>
                {block.eyebrow}
              </p>
            )
          )}
          {editable ? (
            <RichTextEditor
              value={block.heading}
              onChange={(html) => onUpdateBlock!((b) => ({ ...b, heading: html }) as TextBlock)}
              editable
              defaultTextType="h2"
              defaultFontSize="26px"
              style={{ color: textColor, fontSize: 26, fontWeight: 800, lineHeight: 1.14, marginBottom: 12 }}
            />
          ) : (
            <h2
              className="mb-3 text-[26px] font-extrabold leading-tight"
              style={{ color: textColor }}
              dangerouslySetInnerHTML={previewHtml(stripOuterP(block.heading))}
            />
          )}
          {editable ? (
            <RichTextEditor
              value={block.body}
              onChange={(html) => onUpdateBlock!((b) => ({ ...b, body: html }) as TextBlock)}
              editable
              defaultTextType="p"
              defaultFontSize="14px"
              style={{ color: textColor, fontSize: 14, lineHeight: 1.65 }}
            />
          ) : (
            <div
              className="text-sm leading-relaxed"
              style={{ color: textColor }}
              dangerouslySetInnerHTML={previewHtml(block.body)}
            />
          )}
        </div>
      );

    case "articleCard": {
      const showCta = block.showCta ?? Boolean(block.linkUrl);
      const ctaStyle = block.ctaStyle ?? "link";
      const articleImage = (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={block.imageSrc || "https://placehold.co/280x180/e8e8e8/888888?text=Image"}
          alt={block.imageAlt}
          className="aspect-[4/3] w-full rounded-md object-cover"
        />
      );
      const articleCta =
        showCta && (block.linkLabel || block.linkUrl) ? (
          ctaStyle === "button" ? (
            <span
              className="inline-block self-start"
              style={{
                backgroundColor: s.buttonBackgroundColor,
                border: "1px solid transparent",
                borderRadius: s.buttonRadius,
                color: s.buttonTextColor,
                fontSize: Math.max(12, s.buttonFontSize - 2),
                fontWeight: 700,
                lineHeight: 1,
                padding: `${Math.max(7, s.buttonPaddingY - 5)}px ${Math.max(12, s.buttonPaddingX - 6)}px`,
              }}
            >
              {block.linkLabel || "Read more"}
            </span>
          ) : (
            <span className="text-xs font-bold" style={{ color: s.linkColor }}>
              {block.linkLabel || "Read more"} →
            </span>
          )
        ) : null;

      return (
        <div style={{ padding: `18px ${s.padding}px 22px`, fontFamily: s.fontFamily }}>
          <div
            className={cn(
              "grid items-start gap-5",
              block.imagePosition === "left"
                ? "grid-cols-[40%_minmax(0,1fr)]"
                : "grid-cols-[minmax(0,1fr)_40%]",
            )}
          >
            {block.imagePosition === "left" && articleImage}
            <div className="flex min-w-0 flex-col justify-start">
              {editable ? (
                <RichTextEditor
                  value={block.headline}
                  onChange={(html) => onUpdateBlock!((b) => ({ ...b, headline: html }) as ArticleCardBlock)}
                  editable
                  defaultTextType="h3"
                  defaultFontSize="16px"
                  style={{ color: textColor, fontSize: 16, fontWeight: 800, lineHeight: 1.25, marginBottom: 8 }}
                />
              ) : (
                <h3
                  className="mb-2 text-base font-extrabold leading-tight"
                  style={{ color: textColor }}
                  dangerouslySetInnerHTML={previewHtml(stripOuterP(block.headline))}
                />
              )}
              {editable ? (
                <RichTextEditor
                  value={block.body}
                  onChange={(html) => onUpdateBlock!((b) => ({ ...b, body: html }) as ArticleCardBlock)}
                  editable
                  defaultTextType="p"
                  defaultFontSize="13px"
                  style={{ color: textColor, fontSize: 13, lineHeight: 1.6, opacity: 0.82, marginBottom: showCta ? 14 : 0 }}
                />
              ) : (
                <div
                  className={cn("text-[13px] leading-relaxed", showCta && "mb-3")}
                  style={{ color: textColor, opacity: 0.82 }}
                  dangerouslySetInnerHTML={previewHtml(block.body)}
                />
              )}
              {articleCta}
            </div>
            {block.imagePosition === "right" && articleImage}
          </div>
        </div>
      );
    }

    case "columns": {
      // Read-only render — interactive editing lives in <ColumnsCanvas>; this
      // path is used for the drag overlay snapshot.
      const cellBorder =
        block.borderStyle !== "none"
          ? `1px ${block.borderStyle} ${block.borderColor}`
          : undefined;
      return (
        <div style={{ padding: `4px ${s.padding}px 24px` }}>
          <div
            className="grid items-stretch"
            style={{
              gap: block.gap,
              gridTemplateColumns: block.columns.map((column) => `${column.width || 1}fr`).join(" "),
            }}
          >
            {block.columns.map((column) => (
              <div
                key={column.id}
                className="min-w-0"
                style={{
                  padding: block.cellPadding,
                  border: cellBorder,
                  borderRadius: block.borderRadius,
                  backgroundColor: block.columnBackgroundColor,
                }}
              >
                {column.showImage ? (
                  column.imageSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={column.imageSrc}
                      alt={column.imageAlt}
                      className="mb-3 aspect-[4/3] w-full rounded-md object-cover"
                    />
                  ) : (
                    <div className="mb-3 flex aspect-[4/3] w-full items-center justify-center rounded-md bg-muted text-sm font-semibold text-muted-foreground">
                      Image
                    </div>
                  )
                ) : null}
                {column.eyebrow ? (
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: s.accentColor }}>
                    {column.eyebrow}
                  </p>
                ) : null}
                <h3
                  className="mb-2 text-lg font-extrabold leading-tight"
                  style={{ color: textColor }}
                  dangerouslySetInnerHTML={previewHtml(stripOuterP(column.heading))}
                />
                <div
                  className={cn("text-sm leading-relaxed", column.showCta && "mb-3")}
                  style={{ color: textColor, opacity: 0.82 }}
                  dangerouslySetInnerHTML={previewHtml(column.body)}
                />
                {column.showCta ? (
                  <span className="text-xs font-bold" style={{ color: s.linkColor }}>
                    {column.linkLabel || "Learn more"} →
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "button": {
      const full = block.fullWidth ?? false;
      return (
        <div style={{ padding: `4px ${s.padding}px 12px`, textAlign: full ? "center" : block.align, fontFamily: s.fontFamily }}>
          <span className={cn(full ? "flex flex-col gap-2" : "inline-flex flex-wrap gap-2 align-top")}>
            {getButtonItems(block).map((button, index) => (
              <span
                key={`${button.label}-${index}`}
                className={cn("inline-block", full && "block w-full text-center")}
                style={{
                  ...getButtonColors(button.variant, s),
                  border:
                    button.variant === "secondary"
                      ? `1px solid ${s.secondaryButtonTextColor}`
                      : "1px solid transparent",
                  borderRadius: s.buttonRadius,
                  fontSize: s.buttonFontSize,
                  fontWeight: 700,
                  lineHeight: 1,
                  padding: `${s.buttonPaddingY}px ${s.buttonPaddingX}px`,
                }}
              >
                {button.label}
              </span>
            ))}
          </span>
        </div>
      );
    }

    case "divider":
      return (
        <div style={{ padding: `8px ${s.padding}px 28px` }}>
          <div className="h-px" style={{ backgroundColor: textColor, opacity: 0.24 }} />
        </div>
      );

    case "spacer":
      return (
        <div style={{ height: block.height }} className="relative">
          {isSelected && (
            <div className="absolute inset-x-4 inset-y-1 rounded border border-dashed border-muted-foreground/25" />
          )}
        </div>
      );

    case "video":
      return (
        <div style={{ padding: `16px ${s.padding}px` }}>
          <div className="overflow-hidden rounded-lg bg-zinc-900">
            <div className="flex h-36 flex-col items-center justify-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                <HugeiconsIcon icon={Video01Icon} strokeWidth={2} className="size-6 text-white" />
              </div>
              <p className="px-8 text-center text-xs text-white/40">
                {block.url || "Add a video URL in the inspector"}
              </p>
            </div>
          </div>
          {block.caption && (
            <p className="mt-2 text-center text-xs text-muted-foreground">{block.caption}</p>
          )}
        </div>
      );

    case "social":
      return (
        <div style={{ padding: `16px ${s.padding}px`, textAlign: block.align }}>
          <div
            className={cn(
              "flex flex-wrap gap-2",
              block.align === "center" && "justify-center",
              block.align === "right" && "justify-end",
            )}
          >
            {block.links.map((link) => (
              // Same PNGs the compiler points at, served same-origin here.
              // Half-faded when there is no URL yet: the compiler drops those
              // from the sent email, and this is the only place that shows
              // which ones are still unfinished.
              // next/image is wrong here: the src is data-driven (it can be
              // any uploaded custom icon) and these are 32px, so a loader
              // round-trip per icon buys nothing.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={link.id}
                src={socialIconSrc(link)}
                alt={socialLabel(link)}
                title={socialLabel(link)}
                className={cn(
                  "h-8 w-8 rounded-full object-cover",
                  !link.url.trim() && "opacity-40",
                )}
              />
            ))}
          </div>
        </div>
      );

    case "footer":
      return (
        <div
          style={{ padding: `20px ${s.padding}px`, fontFamily: s.fontFamily, textAlign: "center" }}
          className="border-t border-foreground/5"
        >
          <p className="text-xs text-muted-foreground">© {block.companyName}</p>
          <p className="mt-0.5 text-xs text-muted-foreground/70">{block.address}</p>
        </div>
      );

    case "rawHtml": {
      if (editable) {
        return (
          <EditableHtmlBlock
            block={block}
            settings={s}
            textColor={textColor}
            onUpdateBlock={onUpdateBlock!}
          />
        );
      }
      return block.html.trim() ? (
        <div
          className="px-4 py-3 text-sm"
          style={{ color: textColor, fontFamily: s.fontFamily }}
          dangerouslySetInnerHTML={previewHtml(block.html)}
        />
      ) : (
        <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
          <HugeiconsIcon icon={CodeIcon} strokeWidth={1.75} className="size-4" />
          {block.label || "Raw HTML block"}
        </div>
      );
    }
  }
}

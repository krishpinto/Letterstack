"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { CodeIcon, Image01Icon, Video01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "./rich-text-editor";
import {
  type ArticleCardBlock,
  type ColumnsBlock,
  type EmailBlock,
  type EmailDocument,
  type HeadingBlock,
  type LogoBlock,
  type ParagraphBlock,
  type TextBlock,
} from "@/lib/email/document";

function stripOuterP(html: string): string {
  const stripped = html.replace(/^<p[^>]*>([\s\S]*?)<\/p>\s*$/i, "$1").trim();
  return stripped || html;
}

const SOCIAL_CHARS: Record<string, string> = {
  facebook:  "f",
  twitter:   "𝕏",
  instagram: "ig",
  linkedin:  "in",
  youtube:   "yt",
};

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
        <div>
          {block.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={block.src}
              alt={block.alt}
              style={{ display: "block", width: `${block.width}%`, maxWidth: "100%", height: "auto", margin: "0 auto" }}
            />
          ) : (
            <div className="flex h-40 flex-col items-center justify-center gap-2 bg-muted">
              <HugeiconsIcon icon={Image01Icon} strokeWidth={1.5} className="size-8 text-muted-foreground/40" />
              <span className="text-xs text-muted-foreground">Add an image URL in the inspector</span>
            </div>
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
              style={{ color: textColor, fontSize: block.level === 1 ? 32 : block.level === 2 ? 24 : 18, fontWeight: 800, lineHeight: 1.2 }}
            />
          ) : (
            <div
              className="font-extrabold leading-tight"
              style={{ color: textColor, fontSize: block.level === 1 ? 32 : block.level === 2 ? 24 : 18 }}
              dangerouslySetInnerHTML={{ __html: stripOuterP(block.text) }}
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
              style={{ color: textColor, fontSize: 15, lineHeight: 1.65 }}
            />
          ) : (
            <div
              className="text-[15px] leading-relaxed"
              style={{ color: textColor }}
              dangerouslySetInnerHTML={{ __html: block.body }}
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
              style={{ color: textColor, fontSize: 26, fontWeight: 800, lineHeight: 1.14, marginBottom: 12 }}
            />
          ) : (
            <h2
              className="mb-3 text-[26px] font-extrabold leading-tight"
              style={{ color: textColor }}
              dangerouslySetInnerHTML={{ __html: stripOuterP(block.heading) }}
            />
          )}
          {editable ? (
            <RichTextEditor
              value={block.body}
              onChange={(html) => onUpdateBlock!((b) => ({ ...b, body: html }) as TextBlock)}
              editable
              style={{ color: textColor, fontSize: 14, lineHeight: 1.65 }}
            />
          ) : (
            <div
              className="text-sm leading-relaxed"
              style={{ color: textColor }}
              dangerouslySetInnerHTML={{ __html: block.body }}
            />
          )}
        </div>
      );

    case "articleCard":
      return (
        <div style={{ padding: `16px ${s.padding}px`, fontFamily: s.fontFamily }}>
          <div className={cn("flex gap-4", block.imagePosition === "right" && "flex-row-reverse")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={block.imageSrc || "https://placehold.co/280x180/e8e8e8/888888?text=Image"}
              alt={block.imageAlt}
              className="rounded object-cover"
              style={{ width: "40%", height: "auto", flexShrink: 0 }}
            />
            <div className="flex min-w-0 flex-col justify-start">
              {editable ? (
                <RichTextEditor
                  value={block.headline}
                  onChange={(html) => onUpdateBlock!((b) => ({ ...b, headline: html }) as ArticleCardBlock)}
                  editable
                  style={{ color: textColor, fontSize: 14, fontWeight: 800, lineHeight: 1.3, marginBottom: 8 }}
                />
              ) : (
                <h3
                  className="mb-2 text-sm font-extrabold leading-snug"
                  style={{ color: textColor }}
                  dangerouslySetInnerHTML={{ __html: stripOuterP(block.headline) }}
                />
              )}
              {editable ? (
                <RichTextEditor
                  value={block.body}
                  onChange={(html) => onUpdateBlock!((b) => ({ ...b, body: html }) as ArticleCardBlock)}
                  editable
                  style={{ color: textColor, fontSize: 12, lineHeight: 1.6, opacity: 0.8, marginBottom: 12 }}
                />
              ) : (
                <div
                  className="mb-3 text-xs leading-relaxed"
                  style={{ color: textColor, opacity: 0.8 }}
                  dangerouslySetInnerHTML={{ __html: block.body }}
                />
              )}
              {block.linkUrl && (
                <span className="text-xs font-bold" style={{ color: s.accentColor }}>
                  {block.linkLabel || "Read more"} →
                </span>
              )}
            </div>
          </div>
        </div>
      );

    case "columns":
      return (
        <div style={{ padding: `4px ${s.padding}px 24px` }}>
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${block.columns.length}, 1fr)` }}
          >
            {block.columns.map((column) => (
              <div key={column.id} className="rounded-md border p-3">
                {editable ? (
                  <RichTextEditor
                    value={column.heading}
                    onChange={(html) =>
                      onUpdateBlock!((b) => ({
                        ...b,
                        columns: (b as ColumnsBlock).columns.map((c) =>
                          c.id === column.id ? { ...c, heading: html } : c,
                        ),
                      }) as ColumnsBlock)
                    }
                    editable
                    style={{ color: textColor, fontSize: 14, fontWeight: 800, lineHeight: 1.3, marginBottom: 6 }}
                  />
                ) : (
                  <h4
                    className="mb-1.5 text-sm font-extrabold leading-tight"
                    style={{ color: textColor }}
                    dangerouslySetInnerHTML={{ __html: stripOuterP(column.heading) }}
                  />
                )}
                {editable ? (
                  <RichTextEditor
                    value={column.body}
                    onChange={(html) =>
                      onUpdateBlock!((b) => ({
                        ...b,
                        columns: (b as ColumnsBlock).columns.map((c) =>
                          c.id === column.id ? { ...c, body: html } : c,
                        ),
                      }) as ColumnsBlock)
                    }
                    editable
                    style={{ color: textColor, fontSize: 12, lineHeight: 1.55, opacity: 0.8 }}
                  />
                ) : (
                  <div
                    className="text-xs leading-relaxed"
                    style={{ color: textColor, opacity: 0.8 }}
                    dangerouslySetInnerHTML={{ __html: column.body }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      );

    case "button":
      return (
        <div style={{ padding: `4px ${s.padding}px 28px`, textAlign: block.align, fontFamily: s.fontFamily }}>
          <span
            className="inline-block text-white"
            style={{
              backgroundColor: s.accentColor,
              borderRadius: s.buttonRadius,
              fontSize: s.buttonFontSize,
              fontWeight: 700,
              lineHeight: 1,
              padding: `${s.buttonPaddingY}px ${s.buttonPaddingX}px`,
            }}
          >
            {block.label}
          </span>
        </div>
      );

    case "divider":
      return (
        <div style={{ padding: `8px ${s.padding}px 28px` }}>
          <div className="h-px bg-foreground/10" />
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
              "flex gap-2",
              block.align === "center" && "justify-center",
              block.align === "right" && "justify-end",
            )}
          >
            {block.links.map((link) => (
              <div
                key={link.id}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ backgroundColor: s.accentColor }}
              >
                {SOCIAL_CHARS[link.platform] ?? link.platform[0].toUpperCase()}
              </div>
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
          <p className="mt-2 text-xs text-muted-foreground underline">{block.unsubscribeText}</p>
        </div>
      );

    case "rawHtml":
      return (
        <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
          <HugeiconsIcon icon={CodeIcon} strokeWidth={1.75} className="size-4" />
          {block.label || "Raw HTML block"}
        </div>
      );
  }
}

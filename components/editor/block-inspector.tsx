"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { HtmlCodeField } from "./html-code-field";
import {
  createColumn,
  updateBlock,
  type ArticleCardBlock,
  type ArticleCtaStyle,
  type BorderStyle,
  type ButtonBlock,
  type ButtonVariant,
  type ColumnMobile,
  type ColumnsBlock,
  type ColumnVAlign,
  type EmailBlock,
  type EmailDocument,
  type FooterBlock,
  type HeadingBlock,
  type ImageBlock,
  type LogoBlock,
  type ParagraphBlock,
  type RawHtmlBlock,
  type SocialBlock,
  type SpacerBlock,
  type TextAlign,
  type TextBlock,
  type VideoBlock,
} from "@/lib/email/document";
import { BLOCK_LABELS } from "./editor-types";
import { ImageUploadInput } from "./image-upload-input";

export function BlockInspector({
  block,
  document,
  onBack,
  onMoveUp,
  onMoveDown,
  onUpdateDocument,
}: {
  block: EmailBlock;
  document: EmailDocument;
  onBack: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdateDocument: (updater: (current: EmailDocument) => EmailDocument) => void;
}) {
  const setBlock = (updater: (block: EmailBlock) => EmailBlock) => {
    onUpdateDocument((current) => updateBlock(current, block.id, updater));
  };

  return (
    <>
      {/* Header */}
      <div className="flex shrink-0 items-center gap-1 border-b px-2 py-1.5">
        <button
          onClick={onBack}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          ← Blocks
        </button>
        <div className="mx-1 h-3 w-px bg-border" />
        <Badge variant="secondary" className="text-[10px]">
          {BLOCK_LABELS[block.type]}
        </Badge>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={onMoveUp}
            title="Move up"
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={2} className="size-3.5" />
          </button>
          <button
            onClick={onMoveDown}
            title="Move down"
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} className="size-3.5" />
          </button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-4">
          <FieldGroup>
            {block.type === "text"        && <TextBlockFields        block={block} onChange={setBlock} />}
            {block.type === "heading"     && <HeadingBlockFields     block={block} onChange={setBlock} />}
            {block.type === "paragraph"   && <ParagraphBlockFields   block={block} onChange={setBlock} />}
            {block.type === "image"       && <ImageBlockFields       block={block} onChange={setBlock} />}
            {block.type === "button"      && <ButtonBlockFields      block={block} onChange={setBlock} />}
            {block.type === "columns"     && <ColumnsBlockFields     block={block} onChange={setBlock} />}
            {block.type === "articleCard" && <ArticleCardBlockFields block={block} onChange={setBlock} />}
            {block.type === "spacer"      && <SpacerBlockFields      block={block} onChange={setBlock} />}
            {block.type === "rawHtml"     && <RawHtmlBlockFields     block={block} onChange={setBlock} />}
            {block.type === "video"       && <VideoBlockFields       block={block} onChange={setBlock} />}
            {block.type === "social"      && <SocialBlockFields      block={block} onChange={setBlock} />}
            {block.type === "logo"        && <LogoBlockFields        block={block} onChange={setBlock} />}
            {block.type === "footer"      && <FooterBlockFields      block={block} onChange={setBlock} />}
            {block.type === "divider" && (
              <Field>
                <FieldTitle>Divider</FieldTitle>
                <FieldDescription>Renders as a 1px horizontal rule.</FieldDescription>
              </Field>
            )}
          </FieldGroup>

          <Separator />

          {/* Per-block styling overrides */}
          <FieldGroup>
            <Field><FieldTitle>Block styling</FieldTitle></Field>

            <Field>
              <FieldLabel>Background</FieldLabel>
              <div className="flex items-center gap-2">
                <div className="grid flex-1 grid-cols-[28px_1fr] items-center gap-2">
                  <input
                    type="color"
                    value={block.backgroundColor ?? "#ffffff"}
                    onChange={(e) => setBlock((b) => ({ ...b, backgroundColor: e.target.value }))}
                    className="h-7 w-7 cursor-pointer rounded border p-0.5"
                  />
                  <Input
                    value={block.backgroundColor ?? ""}
                    placeholder="Transparent"
                    onChange={(e) =>
                      setBlock((b) => ({ ...b, backgroundColor: e.target.value || undefined }))
                    }
                    className="h-7 font-mono text-xs"
                  />
                </div>
                {block.backgroundColor && (
                  <Button
                    variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs"
                    onClick={() => setBlock((b) => ({ ...b, backgroundColor: undefined }))}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </Field>

            <Field>
              <FieldLabel>Text color</FieldLabel>
              <div className="flex items-center gap-2">
                <div className="grid flex-1 grid-cols-[28px_1fr] items-center gap-2">
                  <input
                    type="color"
                    value={block.textColor ?? document.settings.textColor}
                    onChange={(e) => setBlock((b) => ({ ...b, textColor: e.target.value }))}
                    className="h-7 w-7 cursor-pointer rounded border p-0.5"
                  />
                  <Input
                    value={block.textColor ?? ""}
                    placeholder="Default"
                    onChange={(e) =>
                      setBlock((b) => ({ ...b, textColor: e.target.value || undefined }))
                    }
                    className="h-7 font-mono text-xs"
                  />
                </div>
                {block.textColor && (
                  <Button
                    variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs"
                    onClick={() => setBlock((b) => ({ ...b, textColor: undefined }))}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <InlineNumberField
                id="block-pt" label="Padding top" value={block.paddingTop ?? 0}
                min={0} max={80} step={4} suffix="px"
                onChange={(v) => setBlock((b) => ({ ...b, paddingTop: v || undefined }))}
              />
              <InlineNumberField
                id="block-pb" label="Padding bottom" value={block.paddingBottom ?? 0}
                min={0} max={80} step={4} suffix="px"
                onChange={(v) => setBlock((b) => ({ ...b, paddingBottom: v || undefined }))}
              />
            </div>
          </FieldGroup>
        </div>
      </ScrollArea>
    </>
  );
}

// ─── Per-block field editors ──────────────────────────────────────────────────

function TextBlockFields({
  block, onChange,
}: { block: TextBlock; onChange: (u: (b: EmailBlock) => EmailBlock) => void }) {
  return (
    <>
      <Field>
        <FieldTitle>Content</FieldTitle>
        <FieldDescription>Click the block on the canvas to edit inline.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="eyebrow">Eyebrow label</FieldLabel>
        <Input
          id="eyebrow"
          value={block.eyebrow ?? ""}
          onChange={(e) => onChange((b) => ({ ...b, eyebrow: e.target.value }) as TextBlock)}
        />
      </Field>
      <AlignmentField value={block.align} onChange={(align) => onChange((b) => ({ ...b, align }) as TextBlock)} />
    </>
  );
}

function HeadingBlockFields({
  block, onChange,
}: { block: HeadingBlock; onChange: (u: (b: EmailBlock) => EmailBlock) => void }) {
  return (
    <>
      <Field>
        <FieldTitle>Content</FieldTitle>
        <FieldDescription>Click the block on the canvas to edit inline.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel>Heading level</FieldLabel>
        <ToggleGroup
          type="single"
          value={String(block.level)}
          onValueChange={(v) => {
            if (v) onChange((b) => ({ ...b, level: Number(v) as 1 | 2 | 3 }) as HeadingBlock);
          }}
          variant="outline"
        >
          <ToggleGroupItem value="1">H1</ToggleGroupItem>
          <ToggleGroupItem value="2">H2</ToggleGroupItem>
          <ToggleGroupItem value="3">H3</ToggleGroupItem>
        </ToggleGroup>
      </Field>
      <AlignmentField value={block.align} onChange={(align) => onChange((b) => ({ ...b, align }) as HeadingBlock)} />
    </>
  );
}

function ParagraphBlockFields({
  block, onChange,
}: { block: ParagraphBlock; onChange: (u: (b: EmailBlock) => EmailBlock) => void }) {
  return (
    <>
      <Field>
        <FieldTitle>Content</FieldTitle>
        <FieldDescription>Click the block on the canvas to edit inline.</FieldDescription>
      </Field>
      <AlignmentField value={block.align} onChange={(align) => onChange((b) => ({ ...b, align }) as ParagraphBlock)} />
    </>
  );
}

function ImageBlockFields({
  block, onChange,
}: { block: ImageBlock; onChange: (u: (b: EmailBlock) => EmailBlock) => void }) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor="img-src">Image URL</FieldLabel>
        <ImageUploadInput id="img-src" value={block.src} onChange={(src) => onChange((b) => ({ ...b, src }) as ImageBlock)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="img-alt">Alt text</FieldLabel>
        <Input id="img-alt" value={block.alt} onChange={(e) => onChange((b) => ({ ...b, alt: e.target.value }) as ImageBlock)} />
      </Field>
      <Field>
        <FieldLabel>Width</FieldLabel>
        <FieldContent>
          <Slider value={[block.width]} min={40} max={100} step={5}
            onValueChange={([w]) => onChange((b) => ({ ...b, width: w }) as ImageBlock)} />
          <FieldDescription>{block.width}% of the email container</FieldDescription>
        </FieldContent>
      </Field>
    </>
  );
}

function ButtonBlockFields({
  block, onChange,
}: { block: ButtonBlock; onChange: (u: (b: EmailBlock) => EmailBlock) => void }) {
  const setButton = (patch: Partial<ButtonBlock>) =>
    onChange((b) => ({ ...b, ...patch }) as ButtonBlock);

  return (
    <>
      <Field>
        <FieldTitle>Primary button</FieldTitle>
      </Field>
      <Field>
        <FieldLabel htmlFor="btn-label">Label</FieldLabel>
        <Input id="btn-label" value={block.label} onChange={(e) => setButton({ label: e.target.value })} />
      </Field>
      <Field>
        <FieldLabel htmlFor="btn-href">Link URL</FieldLabel>
        <Input id="btn-href" value={block.href} onChange={(e) => setButton({ href: e.target.value })} />
      </Field>
      <ButtonVariantField
        value={block.variant ?? "primary"}
        onChange={(variant) => setButton({ variant })}
      />

      {block.secondaryLabel ? (
        <>
          <Separator />
          <Field>
            <div className="flex items-center justify-between gap-2">
              <FieldTitle>Secondary button</FieldTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() =>
                  setButton({
                    secondaryLabel: undefined,
                    secondaryHref: undefined,
                    secondaryVariant: undefined,
                  })
                }
              >
                Remove
              </Button>
            </div>
          </Field>
          <Field>
            <FieldLabel htmlFor="btn-secondary-label">Label</FieldLabel>
            <Input
              id="btn-secondary-label"
              value={block.secondaryLabel}
              onChange={(e) => setButton({ secondaryLabel: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="btn-secondary-href">Link URL</FieldLabel>
            <Input
              id="btn-secondary-href"
              value={block.secondaryHref ?? ""}
              onChange={(e) => setButton({ secondaryHref: e.target.value })}
            />
          </Field>
          <ButtonVariantField
            value={block.secondaryVariant ?? "secondary"}
            onChange={(variant) => setButton({ secondaryVariant: variant })}
          />
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 justify-start"
          onClick={() =>
            setButton({
              secondaryLabel: "Learn more",
              secondaryHref: "",
              secondaryVariant: "secondary",
            })
          }
        >
          Add secondary button
        </Button>
      )}

      <Field>
        <FieldTitle>Layout</FieldTitle>
      </Field>
      <AlignmentField value={block.align} onChange={(align) => onChange((b) => ({ ...b, align }) as ButtonBlock)} />
    </>
  );
}

function ButtonVariantField({
  value,
  onChange,
}: {
  value: ButtonVariant;
  onChange: (variant: ButtonVariant) => void;
}) {
  return (
    <Field>
      <FieldLabel>Button type</FieldLabel>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => {
          if (v) onChange(v as ButtonVariant);
        }}
        variant="outline"
      >
        <ToggleGroupItem value="primary">Primary</ToggleGroupItem>
        <ToggleGroupItem value="secondary">Secondary</ToggleGroupItem>
      </ToggleGroup>
    </Field>
  );
}

function ArticleCardBlockFields({
  block, onChange,
}: { block: ArticleCardBlock; onChange: (u: (b: EmailBlock) => EmailBlock) => void }) {
  const setArticle = (patch: Partial<ArticleCardBlock>) =>
    onChange((b) => ({ ...b, ...patch }) as ArticleCardBlock);

  return (
    <>
      <Field>
        <FieldTitle>Content</FieldTitle>
        <FieldDescription>Click the block on the canvas to edit inline.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="article-img">Image URL</FieldLabel>
        <ImageUploadInput id="article-img" value={block.imageSrc} onChange={(imageSrc) => setArticle({ imageSrc })} />
      </Field>
      <Field>
        <FieldLabel>Image position</FieldLabel>
        <ToggleGroup
          type="single"
          value={block.imagePosition}
          onValueChange={(v) => { if (v) setArticle({ imagePosition: v as ArticleCardBlock["imagePosition"] }); }}
          variant="outline"
        >
          <ToggleGroupItem value="left">Image left</ToggleGroupItem>
          <ToggleGroupItem value="right">Image right</ToggleGroupItem>
        </ToggleGroup>
      </Field>

      <Separator />

      <Field>
        <FieldLabel>Read more CTA</FieldLabel>
        <ToggleGroup
          type="single"
          value={block.showCta ? "on" : "off"}
          onValueChange={(value) => {
            if (value) setArticle({ showCta: value === "on" });
          }}
          variant="outline"
          className="grid grid-cols-2"
        >
          <ToggleGroupItem value="on">On</ToggleGroupItem>
          <ToggleGroupItem value="off">Off</ToggleGroupItem>
        </ToggleGroup>
        <FieldDescription>Show or hide the article action.</FieldDescription>
      </Field>

      {block.showCta && (
        <Field>
          <FieldLabel>CTA type</FieldLabel>
          <ToggleGroup
            type="single"
            value={block.ctaStyle}
            onValueChange={(v) => {
              if (v) setArticle({ ctaStyle: v as ArticleCtaStyle });
            }}
            variant="outline"
          >
            <ToggleGroupItem value="link">Link</ToggleGroupItem>
            <ToggleGroupItem value="button">Button</ToggleGroupItem>
          </ToggleGroup>
        </Field>
      )}

      <Field>
        <FieldLabel htmlFor="article-link-label">Link label</FieldLabel>
        <Input
          id="article-link-label"
          value={block.linkLabel}
          disabled={!block.showCta}
          onChange={(e) => setArticle({ linkLabel: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="article-link-url">Link URL</FieldLabel>
        <Input
          id="article-link-url"
          value={block.linkUrl}
          disabled={!block.showCta}
          onChange={(e) => setArticle({ linkUrl: e.target.value })}
        />
      </Field>
    </>
  );
}

function ColumnsBlockFields({
  block, onChange,
}: { block: ColumnsBlock; onChange: (u: (b: EmailBlock) => EmailBlock) => void }) {
  const set = (patch: Partial<ColumnsBlock>) =>
    onChange((b) => ({ ...b, ...patch }) as ColumnsBlock);

  const setColumnCount = (count: number) =>
    onChange((b) => {
      if (b.type !== "columns") return b;
      const cur = b.columns;
      let next;
      if (count > cur.length) {
        next = [...cur, ...Array.from({ length: count - cur.length }, () => createColumn())];
      } else {
        next = cur.slice(0, count);
      }
      return { ...b, columns: next.map((c) => ({ ...c, width: 1 })) } as ColumnsBlock;
    });

  const setColumn = (
    columnId: string,
    patch: Partial<ColumnsBlock["columns"][number]>,
  ) =>
    onChange((b) => {
      if (b.type !== "columns") return b;
      return {
        ...b,
        columns: b.columns.map((column) =>
          column.id === columnId ? { ...column, ...patch } : column,
        ),
      } as ColumnsBlock;
    });

  return (
    <>
      <Field>
        <FieldLabel>Number of columns</FieldLabel>
        <ToggleGroup
          type="single"
          value={String(block.columns.length)}
          onValueChange={(v) => { if (v) setColumnCount(Number(v)); }}
          variant="outline"
        >
          {[2, 3, 4].map((n) => (
            <ToggleGroupItem key={n} value={String(n)}>{n}</ToggleGroupItem>
          ))}
        </ToggleGroup>
        <FieldDescription>Preset email columns. Inner block dropping is disabled.</FieldDescription>
      </Field>

      <Field>
        <FieldLabel>Mobile content orientation</FieldLabel>
        <ToggleGroup
          type="single"
          value={block.mobile}
          onValueChange={(v) => { if (v) set({ mobile: v as ColumnMobile }); }}
          variant="outline"
        >
          <ToggleGroupItem value="stack">Stack</ToggleGroupItem>
          <ToggleGroupItem value="stack-reverse">Reverse</ToggleGroupItem>
          <ToggleGroupItem value="row">Row</ToggleGroupItem>
        </ToggleGroup>
      </Field>

      <Field>
        <FieldLabel>Column background</FieldLabel>
        <div className="flex items-center gap-2">
          <div className="grid flex-1 grid-cols-[28px_1fr] items-center gap-2">
            <input
              type="color"
              value={block.columnBackgroundColor ?? "#ffffff"}
              onChange={(e) => set({ columnBackgroundColor: e.target.value })}
              className="h-7 w-7 cursor-pointer rounded border p-0.5"
            />
            <Input
              value={block.columnBackgroundColor ?? ""}
              placeholder="Transparent"
              onChange={(e) => set({ columnBackgroundColor: e.target.value || undefined })}
              className="h-7 font-mono text-xs"
            />
          </div>
          {block.columnBackgroundColor && (
            <Button
              variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs"
              onClick={() => set({ columnBackgroundColor: undefined })}
            >
              Clear
            </Button>
          )}
        </div>
      </Field>

      <Field>
        <FieldLabel>Border</FieldLabel>
        <ToggleGroup
          type="single"
          value={block.borderStyle}
          onValueChange={(v) => { if (v) set({ borderStyle: v as BorderStyle }); }}
          variant="outline"
        >
          <ToggleGroupItem value="none">None</ToggleGroupItem>
          <ToggleGroupItem value="solid">Solid</ToggleGroupItem>
          <ToggleGroupItem value="dashed">Dashed</ToggleGroupItem>
          <ToggleGroupItem value="dotted">Dotted</ToggleGroupItem>
        </ToggleGroup>
      </Field>

      {block.borderStyle !== "none" && (
        <Field>
          <FieldLabel>Border color</FieldLabel>
          <div className="grid grid-cols-[28px_1fr] items-center gap-2">
            <input
              type="color"
              value={block.borderColor}
              onChange={(e) => set({ borderColor: e.target.value })}
              className="h-7 w-7 cursor-pointer rounded border p-0.5"
            />
            <Input
              value={block.borderColor}
              onChange={(e) => set({ borderColor: e.target.value })}
              className="h-7 font-mono text-xs"
            />
          </div>
        </Field>
      )}

      <Field>
        <FieldLabel>Vertical alignment</FieldLabel>
        <ToggleGroup
          type="single"
          value={block.valign}
          onValueChange={(v) => { if (v) set({ valign: v as ColumnVAlign }); }}
          variant="outline"
        >
          <ToggleGroupItem value="top">Top</ToggleGroupItem>
          <ToggleGroupItem value="middle">Middle</ToggleGroupItem>
          <ToggleGroupItem value="bottom">Bottom</ToggleGroupItem>
        </ToggleGroup>
      </Field>

      <Field>
        <FieldLabel>Rounded corners</FieldLabel>
        <FieldContent>
          <Slider value={[block.borderRadius]} min={0} max={32} step={1}
            onValueChange={([v]) => set({ borderRadius: v })} />
          <FieldDescription>{block.borderRadius}px</FieldDescription>
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel>Column gap</FieldLabel>
        <FieldContent>
          <Slider value={[block.gap]} min={0} max={40} step={2}
            onValueChange={([v]) => set({ gap: v })} />
          <FieldDescription>{block.gap}px between columns</FieldDescription>
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel>Cell padding</FieldLabel>
        <FieldContent>
          <Slider value={[block.cellPadding]} min={0} max={40} step={2}
            onValueChange={([v]) => set({ cellPadding: v })} />
          <FieldDescription>{block.cellPadding}px inside each column</FieldDescription>
        </FieldContent>
      </Field>

      <Separator />

      <FieldGroup>
        {block.columns.map((column, index) => (
          <Field key={column.id} className="gap-3">
            <FieldTitle>Column {index + 1}</FieldTitle>
            <div className="grid gap-2">
              <Input
                value={plainFromHtml(column.heading)}
                placeholder="Column headline"
                onChange={(e) => setColumn(column.id, { heading: htmlFromPlain(e.target.value) })}
              />
              <Textarea
                rows={3}
                value={plainFromHtml(column.body)}
                placeholder="Column description"
                onChange={(e) => setColumn(column.id, { body: htmlFromPlain(e.target.value) })}
              />
            </div>

            <Field>
              <FieldLabel>Image</FieldLabel>
              <ToggleGroup
                type="single"
                value={column.showImage ? "on" : "off"}
                onValueChange={(v) => {
                  if (v) setColumn(column.id, { showImage: v === "on" });
                }}
                variant="outline"
              >
                <ToggleGroupItem value="on">On</ToggleGroupItem>
                <ToggleGroupItem value="off">Off</ToggleGroupItem>
              </ToggleGroup>
            </Field>
            {column.showImage && (
              <Field>
                <FieldLabel>Image URL</FieldLabel>
                <ImageUploadInput
                  value={column.imageSrc}
                  placeholder="https://..."
                  onChange={(imageSrc) => setColumn(column.id, { imageSrc })}
                />
              </Field>
            )}

            <Field>
              <FieldLabel>CTA</FieldLabel>
              <ToggleGroup
                type="single"
                value={column.showCta ? "on" : "off"}
                onValueChange={(v) => {
                  if (v) setColumn(column.id, { showCta: v === "on" });
                }}
                variant="outline"
              >
                <ToggleGroupItem value="on">On</ToggleGroupItem>
                <ToggleGroupItem value="off">Off</ToggleGroupItem>
              </ToggleGroup>
            </Field>
            {column.showCta && (
              <div className="grid gap-2">
                <Input
                  value={column.linkLabel}
                  placeholder="CTA label"
                  onChange={(e) => setColumn(column.id, { linkLabel: e.target.value })}
                />
                <Input
                  value={column.linkUrl}
                  placeholder="https://..."
                  onChange={(e) => setColumn(column.id, { linkUrl: e.target.value })}
                />
              </div>
            )}
          </Field>
        ))}
      </FieldGroup>
    </>
  );
}

function plainFromHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function htmlFromPlain(value: string) {
  const text = value.trim();
  return text ? `<p>${text}</p>` : "<p></p>";
}

function SpacerBlockFields({
  block, onChange,
}: { block: SpacerBlock; onChange: (u: (b: EmailBlock) => EmailBlock) => void }) {
  return (
    <Field>
      <FieldLabel>Height</FieldLabel>
      <FieldContent>
        <Slider value={[block.height]} min={8} max={80} step={4}
          onValueChange={([h]) => onChange((b) => ({ ...b, height: h }) as SpacerBlock)} />
        <FieldDescription>{block.height}px vertical gap</FieldDescription>
      </FieldContent>
    </Field>
  );
}

function RawHtmlBlockFields({
  block, onChange,
}: { block: RawHtmlBlock; onChange: (u: (b: EmailBlock) => EmailBlock) => void }) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor="raw-label">Label</FieldLabel>
        <Input id="raw-label" value={block.label} onChange={(e) => onChange((b) => ({ ...b, label: e.target.value }) as RawHtmlBlock)} />
      </Field>
      <Field>
        <FieldLabel>HTML</FieldLabel>
        <HtmlCodeField
          value={block.html}
          onCommit={({ html, text }) =>
            // text is derived from the markup so the plain-text part of the
            // email never falls out of sync with what's rendered.
            onChange((b) => ({ ...b, html, text }) as RawHtmlBlock)
          }
        />
        <FieldDescription>
          Goes inside the email&apos;s table cell, so paste content rather than a
          whole page — a full document is trimmed to its &lt;body&gt;. Use tables
          and inline styles; flexbox and grid don&apos;t render in Outlook.
        </FieldDescription>
      </Field>
    </>
  );
}

function VideoBlockFields({
  block, onChange,
}: { block: VideoBlock; onChange: (u: (b: EmailBlock) => EmailBlock) => void }) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor="video-url">Video URL</FieldLabel>
        <Input id="video-url" value={block.url} placeholder="https://youtube.com/..."
          onChange={(e) => onChange((b) => ({ ...b, url: e.target.value }) as VideoBlock)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="video-cap">Caption</FieldLabel>
        <Input id="video-cap" value={block.caption}
          onChange={(e) => onChange((b) => ({ ...b, caption: e.target.value }) as VideoBlock)} />
      </Field>
    </>
  );
}

function SocialBlockFields({
  block, onChange,
}: { block: SocialBlock; onChange: (u: (b: EmailBlock) => EmailBlock) => void }) {
  return (
    <>
      <Field><FieldTitle>Social links</FieldTitle></Field>
      {block.links.map((link) => (
        <Field key={link.id}>
          <FieldLabel className="capitalize">{link.platform}</FieldLabel>
          <Input
            value={link.url}
            placeholder={`https://${link.platform}.com/...`}
            onChange={(e) =>
              onChange((b) => ({
                ...b,
                links: (b as SocialBlock).links.map((l) =>
                  l.id === link.id ? { ...l, url: e.target.value } : l,
                ),
              }) as SocialBlock)
            }
          />
        </Field>
      ))}
      <AlignmentField value={block.align} onChange={(align) => onChange((b) => ({ ...b, align }) as SocialBlock)} />
    </>
  );
}

function LogoBlockFields({
  block, onChange,
}: { block: LogoBlock; onChange: (u: (b: EmailBlock) => EmailBlock) => void }) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor="logo-src">Logo URL</FieldLabel>
        <ImageUploadInput id="logo-src" value={block.src} placeholder="https://yoursite.com/logo.png"
          onChange={(src) => onChange((b) => ({ ...b, src }) as LogoBlock)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="logo-alt">Alt text</FieldLabel>
        <Input id="logo-alt" value={block.alt}
          onChange={(e) => onChange((b) => ({ ...b, alt: e.target.value }) as LogoBlock)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="logo-href">Link URL</FieldLabel>
        <Input id="logo-href" value={block.href ?? ""}
          onChange={(e) => onChange((b) => ({ ...b, href: e.target.value || undefined }) as LogoBlock)} />
      </Field>
      <Field>
        <FieldLabel>Width</FieldLabel>
        <FieldContent>
          <Slider value={[block.width]} min={10} max={80} step={5}
            onValueChange={([w]) => onChange((b) => ({ ...b, width: w }) as LogoBlock)} />
          <FieldDescription>{block.width}%</FieldDescription>
        </FieldContent>
      </Field>
      <AlignmentField value={block.align} onChange={(align) => onChange((b) => ({ ...b, align }) as LogoBlock)} />
    </>
  );
}

function FooterBlockFields({
  block, onChange,
}: { block: FooterBlock; onChange: (u: (b: EmailBlock) => EmailBlock) => void }) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor="footer-co">Company name</FieldLabel>
        <Input id="footer-co" value={block.companyName}
          onChange={(e) => onChange((b) => ({ ...b, companyName: e.target.value }) as FooterBlock)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="footer-addr">Address</FieldLabel>
        <Input id="footer-addr" value={block.address}
          onChange={(e) => onChange((b) => ({ ...b, address: e.target.value }) as FooterBlock)} />
      </Field>
    </>
  );
}

function AlignmentField({
  value, onChange,
}: { value: TextAlign; onChange: (a: TextAlign) => void }) {
  return (
    <Field>
      <FieldLabel>Alignment</FieldLabel>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => { if (v) onChange(v as TextAlign); }}
        variant="outline"
      >
        <ToggleGroupItem value="left">Left</ToggleGroupItem>
        <ToggleGroupItem value="center">Center</ToggleGroupItem>
        <ToggleGroupItem value="right">Right</ToggleGroupItem>
      </ToggleGroup>
    </Field>
  );
}

function InlineNumberField({
  id, label, value, min, max, step, suffix, onChange,
}: {
  id: string; label: string; value: number; min: number; max: number; step: number;
  suffix: string; onChange: (v: number) => void;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted-foreground">{label}</label>
      <div className="relative">
        <Input
          id={id} type="number" value={value} min={min} max={max} step={step}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          className="h-7 pr-7 text-right text-xs"
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {suffix}
        </span>
      </div>
    </div>
  );
}

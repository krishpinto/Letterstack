"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowUp01Icon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
} from "@hugeicons/core-free-icons";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { SocialLinksField } from "./social-links-field";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HtmlCodeField } from "./html-code-field";
import { OptionToggle, SliderField } from "./inspector-controls";
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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onBack}
              aria-label="Back to blocks"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} data-icon="icon" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Back to blocks</TooltipContent>
        </Tooltip>
        <div className="mx-0.5 h-3 w-px bg-border" />
        <Badge variant="secondary" className="text-[10px]">
          {BLOCK_LABELS[block.type]}
        </Badge>
        <div className="ml-auto flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onMoveUp}
                aria-label="Move block up"
              >
                <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={2} data-icon="icon" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move up</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onMoveDown}
                aria-label="Move block down"
              >
                <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} data-icon="icon" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move down</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-scrollbar]]:hidden">
        {/* One section open at a time (like the theme editor); the block's own
            content section starts open. */}
        <Accordion type="single" collapsible defaultValue="content" className="w-full">
          <AccordionItem value="content">
            <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
              {BLOCK_LABELS[block.type]}
            </AccordionTrigger>
            <AccordionContent className="h-auto px-4 pb-4">
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
                    <FieldDescription>Renders as a 1px horizontal rule.</FieldDescription>
                  </Field>
                )}
              </FieldGroup>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="styling">
            <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">
              Block styling
            </AccordionTrigger>
            <AccordionContent className="h-auto px-4 pb-4">
              <FieldGroup>
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

                <SliderField
                  label="Padding top" value={block.paddingTop ?? 0}
                  min={0} max={80} step={4} suffix="px"
                  onChange={(v) => setBlock((b) => ({ ...b, paddingTop: v || undefined }))}
                />
                <SliderField
                  label="Padding bottom" value={block.paddingBottom ?? 0}
                  min={0} max={80} step={4} suffix="px"
                  onChange={(v) => setBlock((b) => ({ ...b, paddingBottom: v || undefined }))}
                />
              </FieldGroup>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
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
        <OptionToggle
          ariaLabel="Heading level"
          value={String(block.level)}
          onChange={(v) => onChange((b) => ({ ...b, level: Number(v) as 1 | 2 | 3 }) as HeadingBlock)}
          options={[
            { value: "1", label: "H1" },
            { value: "2", label: "H2" },
            { value: "3", label: "H3" },
          ]}
        />
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
        <FieldLabel htmlFor="img-href">Link URL</FieldLabel>
        <Input
          id="img-href"
          value={block.href ?? ""}
          placeholder="https://… (optional)"
          onChange={(e) => onChange((b) => ({ ...b, href: e.target.value || undefined }) as ImageBlock)}
        />
        <FieldDescription>Makes the image clickable in the email.</FieldDescription>
      </Field>
      <SliderField
        label="Width" value={block.width} min={40} max={100} step={5} suffix="%"
        description="Percentage of the email container"
        onChange={(w) => onChange((b) => ({ ...b, width: w }) as ImageBlock)}
      />
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
      <Field>
        <FieldLabel>Button width</FieldLabel>
        <OptionToggle
          ariaLabel="Button width"
          value={block.fullWidth ? "full" : "auto"}
          onChange={(v) => setButton({ fullWidth: v === "full" })}
          options={[
            { value: "auto", label: "Default" },
            { value: "full", label: "Stretched" },
          ]}
        />
        <FieldDescription>
          {block.fullWidth ? "Fills the content width." : "Hugs the label."}
        </FieldDescription>
      </Field>
      {!block.fullWidth && (
        <AlignmentField value={block.align} onChange={(align) => onChange((b) => ({ ...b, align }) as ButtonBlock)} />
      )}
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
      <OptionToggle
        ariaLabel="Button type"
        value={value}
        onChange={(v) => onChange(v as ButtonVariant)}
        options={[
          { value: "primary", label: "Primary" },
          { value: "secondary", label: "Secondary" },
        ]}
      />
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
        <OptionToggle
          ariaLabel="Image position"
          value={block.imagePosition}
          onChange={(v) => setArticle({ imagePosition: v as ArticleCardBlock["imagePosition"] })}
          options={[
            { value: "left", label: "Left" },
            { value: "right", label: "Right" },
          ]}
        />
      </Field>

      <Separator />

      <Field>
        <FieldLabel>Read more CTA</FieldLabel>
        <OptionToggle
          ariaLabel="Read more CTA"
          value={block.showCta ? "on" : "off"}
          onChange={(v) => setArticle({ showCta: v === "on" })}
          options={[
            { value: "on", label: "On" },
            { value: "off", label: "Off" },
          ]}
        />
        <FieldDescription>Show or hide the article action.</FieldDescription>
      </Field>

      {block.showCta && (
        <Field>
          <FieldLabel>CTA type</FieldLabel>
          <OptionToggle
            ariaLabel="CTA type"
            value={block.ctaStyle}
            onChange={(v) => setArticle({ ctaStyle: v as ArticleCtaStyle })}
            options={[
              { value: "link", label: "Link" },
              { value: "button", label: "Button" },
            ]}
          />
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
        <OptionToggle
          ariaLabel="Number of columns"
          value={String(block.columns.length)}
          onChange={(v) => setColumnCount(Number(v))}
          options={[2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))}
        />
        <FieldDescription>Preset email columns. Inner block dropping is disabled.</FieldDescription>
      </Field>

      <Field>
        <FieldLabel>Mobile content orientation</FieldLabel>
        <OptionToggle
          ariaLabel="Mobile content orientation"
          value={block.mobile}
          onChange={(v) => set({ mobile: v as ColumnMobile })}
          options={[
            { value: "stack", label: "Stack" },
            { value: "stack-reverse", label: "Reverse" },
            { value: "row", label: "Row" },
          ]}
        />
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
        <OptionToggle
          ariaLabel="Border style"
          value={block.borderStyle}
          onChange={(v) => set({ borderStyle: v as BorderStyle })}
          options={[
            { value: "none", label: "None" },
            { value: "solid", label: "Solid" },
            { value: "dashed", label: "Dashed" },
            { value: "dotted", label: "Dotted" },
          ]}
        />
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
        <OptionToggle
          ariaLabel="Vertical alignment"
          value={block.valign}
          onChange={(v) => set({ valign: v as ColumnVAlign })}
          options={[
            { value: "top", label: "Top" },
            { value: "middle", label: "Middle" },
            { value: "bottom", label: "Bottom" },
          ]}
        />
      </Field>

      <SliderField
        label="Rounded corners" value={block.borderRadius} min={0} max={32} step={1} suffix="px"
        onChange={(v) => set({ borderRadius: v })}
      />

      <SliderField
        label="Column gap" value={block.gap} min={0} max={40} step={2} suffix="px"
        description="Space between columns"
        onChange={(v) => set({ gap: v })}
      />

      <SliderField
        label="Cell padding" value={block.cellPadding} min={0} max={40} step={2} suffix="px"
        description="Inside each column"
        onChange={(v) => set({ cellPadding: v })}
      />

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
              <OptionToggle
                ariaLabel="Column image"
                value={column.showImage ? "on" : "off"}
                onChange={(v) => setColumn(column.id, { showImage: v === "on" })}
                options={[
                  { value: "on", label: "On" },
                  { value: "off", label: "Off" },
                ]}
              />
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
              <OptionToggle
                ariaLabel="Column CTA"
                value={column.showCta ? "on" : "off"}
                onChange={(v) => setColumn(column.id, { showCta: v === "on" })}
                options={[
                  { value: "on", label: "On" },
                  { value: "off", label: "Off" },
                ]}
              />
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
    <SliderField
      label="Height" value={block.height} min={8} max={80} step={4} suffix="px"
      description="Vertical gap"
      onChange={(h) => onChange((b) => ({ ...b, height: h }) as SpacerBlock)}
    />
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
      <SocialLinksField
        links={block.links}
        onChange={(links) => onChange((b) => ({ ...b, links }) as SocialBlock)}
      />
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
      <SliderField
        label="Width" value={block.width} min={10} max={80} step={5} suffix="%"
        onChange={(w) => onChange((b) => ({ ...b, width: w }) as LogoBlock)}
      />
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
      <OptionToggle
        ariaLabel="Alignment"
        value={value}
        onChange={(v) => onChange(v as TextAlign)}
        options={[
          { value: "left", label: "Align left", icon: TextAlignLeftIcon },
          { value: "center", label: "Align center", icon: TextAlignCenterIcon },
          { value: "right", label: "Align right", icon: TextAlignRightIcon },
        ]}
      />
    </Field>
  );
}


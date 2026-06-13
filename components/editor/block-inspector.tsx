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
import {
  updateBlock,
  type ArticleCardBlock,
  type ButtonBlock,
  type ColumnsBlock,
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
        <Input id="img-src" value={block.src} onChange={(e) => onChange((b) => ({ ...b, src: e.target.value }) as ImageBlock)} />
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
  return (
    <>
      <Field>
        <FieldLabel htmlFor="btn-label">Label</FieldLabel>
        <Input id="btn-label" value={block.label} onChange={(e) => onChange((b) => ({ ...b, label: e.target.value }) as ButtonBlock)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="btn-href">Link URL</FieldLabel>
        <Input id="btn-href" value={block.href} onChange={(e) => onChange((b) => ({ ...b, href: e.target.value }) as ButtonBlock)} />
      </Field>
      <AlignmentField value={block.align} onChange={(align) => onChange((b) => ({ ...b, align }) as ButtonBlock)} />
    </>
  );
}

function ArticleCardBlockFields({
  block, onChange,
}: { block: ArticleCardBlock; onChange: (u: (b: EmailBlock) => EmailBlock) => void }) {
  return (
    <>
      <Field>
        <FieldTitle>Content</FieldTitle>
        <FieldDescription>Click the block on the canvas to edit inline.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="article-img">Image URL</FieldLabel>
        <Input id="article-img" value={block.imageSrc} onChange={(e) => onChange((b) => ({ ...b, imageSrc: e.target.value }) as ArticleCardBlock)} />
      </Field>
      <Field>
        <FieldLabel>Image position</FieldLabel>
        <ToggleGroup
          type="single"
          value={block.imagePosition}
          onValueChange={(v) => { if (v) onChange((b) => ({ ...b, imagePosition: v }) as ArticleCardBlock); }}
          variant="outline"
        >
          <ToggleGroupItem value="left">Image left</ToggleGroupItem>
          <ToggleGroupItem value="right">Image right</ToggleGroupItem>
        </ToggleGroup>
      </Field>
      <Field>
        <FieldLabel htmlFor="article-link-label">Link label</FieldLabel>
        <Input id="article-link-label" value={block.linkLabel} onChange={(e) => onChange((b) => ({ ...b, linkLabel: e.target.value }) as ArticleCardBlock)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="article-link-url">Link URL</FieldLabel>
        <Input id="article-link-url" value={block.linkUrl} onChange={(e) => onChange((b) => ({ ...b, linkUrl: e.target.value }) as ArticleCardBlock)} />
      </Field>
    </>
  );
}

function ColumnsBlockFields({
  block, onChange,
}: { block: ColumnsBlock; onChange: (u: (b: EmailBlock) => EmailBlock) => void }) {
  void onChange;
  return (
    <Field>
      <FieldTitle>Content</FieldTitle>
      <FieldDescription>
        {block.columns.length} columns. Click the block on the canvas to edit inline.
      </FieldDescription>
    </Field>
  );
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
        <FieldLabel htmlFor="raw-html">HTML</FieldLabel>
        <Textarea id="raw-html" rows={7} value={block.html} onChange={(e) => onChange((b) => ({ ...b, html: e.target.value }) as RawHtmlBlock)} />
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
        <Input id="logo-src" value={block.src} placeholder="https://yoursite.com/logo.png"
          onChange={(e) => onChange((b) => ({ ...b, src: e.target.value }) as LogoBlock)} />
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
      <Field>
        <FieldLabel htmlFor="footer-unsub">Unsubscribe text</FieldLabel>
        <Input id="footer-unsub" value={block.unsubscribeText}
          onChange={(e) => onChange((b) => ({ ...b, unsubscribeText: e.target.value }) as FooterBlock)} />
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

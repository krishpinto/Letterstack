import {
  Add01Icon,
  CodeIcon,
  Cursor01Icon,
  ExpandParagraphIcon,
  Image01Icon,
  LayoutTwoColumnIcon,
  News01Icon,
  Share01Icon,
  StarIcon,
  TextAlignJustifyCenterIcon,
  TextIcon,
  Video01Icon,
} from "@hugeicons/core-free-icons";

import type { EmailBlock } from "@/lib/email/document";

export type PreviewMode = "desktop" | "mobile";
export type ActivePanel = "blocks" | "sections" | "styles" | "optimize" | null;

export const FONT_FAMILIES = [
  { label: "Arial",        value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia",      value: "Georgia, 'Times New Roman', serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', Tahoma, sans-serif" },
  { label: "Verdana",      value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma",       value: "Tahoma, Verdana, sans-serif" },
];

export const BLOCK_LABELS: Record<EmailBlock["type"], string> = {
  text:        "Text",
  heading:     "Heading",
  paragraph:   "Paragraph",
  image:       "Image",
  button:      "Button",
  divider:     "Divider",
  spacer:      "Spacer",
  columns:     "Columns",
  articleCard: "Article",
  rawHtml:     "HTML",
  video:       "Video",
  social:      "Social",
  logo:        "Logo",
  footer:      "Footer",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BlockEntry = { type: EmailBlock["type"]; label: string; icon: any };

/**
 * Primitives — one job each, no pre-filled composition. These are the only
 * things the block library offers, so the palette stays a set of parts rather
 * than a mix of parts and finished furniture.
 */
export const BASE_BLOCKS: BlockEntry[] = [
  { type: "image",     label: "Image",     icon: Image01Icon },
  { type: "heading",   label: "Heading",   icon: TextIcon },
  { type: "paragraph", label: "Paragraph", icon: TextAlignJustifyCenterIcon },
  { type: "button",    label: "Button",    icon: Cursor01Icon },
  { type: "divider",   label: "Divider",   icon: TextAlignJustifyCenterIcon },
  { type: "spacer",    label: "Spacer",    icon: ExpandParagraphIcon },
  { type: "video",     label: "Video",     icon: Video01Icon },
  { type: "social",    label: "Social",    icon: Share01Icon },
  { type: "logo",      label: "Logo",      icon: StarIcon },
  { type: "rawHtml",   label: "Code",      icon: CodeIcon },
  { type: "footer",    label: "Footer",    icon: Add01Icon },
];

/**
 * Composites — several elements arranged together with placeholder copy. They
 * are a starting layout rather than a primitive, so they live behind `/` in the
 * assistant instead of sitting in the palette pretending to be a base block.
 */
export const TEMPLATE_BLOCKS: BlockEntry[] = [
  { type: "text",        label: "Text section", icon: News01Icon },
  { type: "articleCard", label: "Article card", icon: LayoutTwoColumnIcon },
];

/** Every insertable block. Used where the distinction doesn't matter. */
export const CONTENT_BLOCKS: BlockEntry[] = [...BASE_BLOCKS, ...TEMPLATE_BLOCKS];

export const COLUMN_LAYOUTS = [
  { label: "1",   widths: [1] },
  { label: "2",   widths: [1, 1] },
  { label: "3",   widths: [1, 1, 1] },
  { label: "4",   widths: [1, 1, 1, 1] },
  { label: "1:2", widths: [1, 2] },
  { label: "2:1", widths: [2, 1] },
];

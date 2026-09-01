import type { SocialPlatform } from "./social";

export type EmailDocument = {
  id: string;
  name: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  updatedAt: string;
  settings: EmailDocumentSettings;
  blocks: EmailBlock[];
};

export type EmailDocumentSettings = {
  previewText: string;
  backgroundColor: string;
  contentColor: string;
  accentColor: string;
  linkColor: string;
  textColor: string;
  fontFamily: string;
  maxWidth: number;
  padding: number;
  radius: number;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowOpacity: number;
  shadowBlur: number;
  shadowSpread: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  buttonBackgroundColor: string;
  buttonTextColor: string;
  secondaryButtonBackgroundColor: string;
  secondaryButtonTextColor: string;
  buttonRadius: number;
  buttonPaddingY: number;
  buttonPaddingX: number;
  buttonFontSize: number;
};

export type EmailBlock =
  | TextBlock
  | HeadingBlock
  | ParagraphBlock
  | ImageBlock
  | ButtonBlock
  | DividerBlock
  | SpacerBlock
  | ColumnsBlock
  | ArticleCardBlock
  | RawHtmlBlock
  | VideoBlock
  | SocialBlock
  | LogoBlock
  | FooterBlock;

export type BaseBlock<TType extends string> = {
  id: string;
  type: TType;
  backgroundColor?: string;
  textColor?: string;
  paddingTop?: number;
  paddingBottom?: number;
};

export type TextBlock = BaseBlock<"text"> & {
  eyebrow?: string;
  heading: string;
  body: string;
  align: TextAlign;
};

export type HeadingBlock = BaseBlock<"heading"> & {
  text: string;
  level: 1 | 2 | 3;
  align: TextAlign;
};

export type ParagraphBlock = BaseBlock<"paragraph"> & {
  body: string;
  align: TextAlign;
};

export type ImageBlock = BaseBlock<"image"> & {
  src: string;
  alt: string;
  width: number;
  /** Optional link — the image becomes clickable and navigates here. */
  href?: string;
};

export type ButtonBlock = BaseBlock<"button"> & {
  label: string;
  href: string;
  align: TextAlign;
  variant: ButtonVariant;
  /** "Stretched" — buttons fill the content width instead of hugging content. */
  fullWidth?: boolean;
  secondaryLabel?: string;
  secondaryHref?: string;
  secondaryVariant?: ButtonVariant;
};

export type ButtonVariant = "primary" | "secondary";

export type DividerBlock = BaseBlock<"divider">;

export type SpacerBlock = BaseBlock<"spacer"> & {
  height: number;
};

export type ColumnVAlign = "top" | "middle" | "bottom";
export type ColumnMobile = "stack" | "stack-reverse" | "row";
export type BorderStyle = "none" | "solid" | "dashed" | "dotted";

export type ColumnsBlock = BaseBlock<"columns"> & {
  columns: ColumnContent[];
  gap: number;
  columnBackgroundColor?: string;
  borderStyle: BorderStyle;
  borderColor: string;
  borderRadius: number;
  valign: ColumnVAlign;
  mobile: ColumnMobile;
  cellPadding: number;
};

export type ColumnContent = {
  id: string;
  /** Relative weight; widths across the row are normalized to percentages. */
  width: number;
  eyebrow?: string;
  heading: string;
  body: string;
  imageSrc: string;
  imageAlt: string;
  linkLabel: string;
  linkUrl: string;
  showImage: boolean;
  showCta: boolean;
  /** Kept for older saved documents; /editor renders preset column content. */
  blocks: EmailBlock[];
};

export type ArticleCardBlock = BaseBlock<"articleCard"> & {
  headline: string;
  body: string;
  imageSrc: string;
  imageAlt: string;
  imagePosition: "left" | "right";
  showCta: boolean;
  ctaStyle: ArticleCtaStyle;
  linkUrl: string;
  linkLabel: string;
};

export type ArticleCtaStyle = "link" | "button";

export type RawHtmlBlock = BaseBlock<"rawHtml"> & {
  label: string;
  html: string;
  text: string;
};

export type VideoBlock = BaseBlock<"video"> & {
  url: string;
  caption: string;
};

export type SocialLink = {
  id: string;
  /** See SOCIAL_PLATFORMS in ./social — the five original ids still parse. */
  platform: SocialPlatform;
  url: string;
  /**
   * `custom` only. The icon image (an UploadThing URL, or any absolute one);
   * without it the custom link falls back to a neutral link tile. `label`
   * becomes the alt text and hover title, since there's no platform name.
   */
  iconSrc?: string;
  label?: string;
};

export type SocialBlock = BaseBlock<"social"> & {
  links: SocialLink[];
  align: TextAlign;
};

export type LogoBlock = BaseBlock<"logo"> & {
  src: string;
  alt: string;
  width: number;
  align: TextAlign;
  href?: string;
};

export type FooterBlock = BaseBlock<"footer"> & {
  companyName: string;
  address: string;
  /** Legacy: old saved documents may carry this; the compiler now appends its
   * own unsubscribe section to every email instead of rendering this. */
  unsubscribeText?: string;
};

export type TextAlign = "left" | "center" | "right";

export const STORAGE_KEY = "letterstack-email-document-v1";

const ARTICLE_PLACEHOLDER_IMAGE =
  "https://placehold.co/280x180/e8e8e8/888888?text=Article+image";

export const initialEmailDocument: EmailDocument = {
  id: "default",
  name: "Untitled Campaign",
  subject: "",
  fromName: "",
  fromEmail: "",
  updatedAt: new Date().toISOString(),
  settings: {
    previewText: "",
    backgroundColor: "#f0ece8",
    contentColor: "#ffffff",
    accentColor: "#E05C3A",
    linkColor: "#E05C3A",
    textColor: "#1a1a1a",
    fontFamily: "Arial, Helvetica, sans-serif",
    maxWidth: 600,
    padding: 24,
    radius: 8,
    shadowEnabled: true,
    shadowColor: "#000000",
    shadowOpacity: 10,
    shadowBlur: 28,
    shadowSpread: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 14,
    buttonBackgroundColor: "#E05C3A",
    buttonTextColor: "#ffffff",
    secondaryButtonBackgroundColor: "#ffffff",
    secondaryButtonTextColor: "#E05C3A",
    buttonRadius: 6,
    buttonPaddingY: 14,
    buttonPaddingX: 18,
    buttonFontSize: 15,
  },
  blocks: [
    {
      id: "block-1",
      type: "text",
      eyebrow: "Newsletter · June 2026",
      heading: "<p>Welcome to LetterStack</p>",
      body: "<p>A beautiful way to send your monthly newsletter. Build with blocks, preview in real time, send with confidence.</p>",
      align: "left",
    },
    {
      id: "block-2",
      type: "articleCard",
      headline: "<p>Your first article headline</p>",
      body: "<p>Write a short summary of the story here. Keep it punchy — two or three sentences is ideal.</p>",
      imageSrc: ARTICLE_PLACEHOLDER_IMAGE,
      imageAlt: "Article image",
      imagePosition: "right",
      showCta: true,
      ctaStyle: "link",
      linkUrl: "https://example.com",
      linkLabel: "Read more",
    },
    {
      id: "block-3",
      type: "button",
      label: "Read the full newsletter",
      href: "https://example.com",
      align: "left",
      variant: "primary",
    },
  ],
};

export function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export function createDocument(
  overrides?: Partial<EmailDocument>
): EmailDocument {
  return {
    id: createId(),
    name: "Untitled Campaign",
    subject: "",
    fromName: "",
    fromEmail: "",
    updatedAt: new Date().toISOString(),
    settings: {
      previewText: "",
      backgroundColor: "#f0ece8",
      contentColor: "#ffffff",
      accentColor: "#E05C3A",
      linkColor: "#E05C3A",
      textColor: "#1a1a1a",
      fontFamily: "Arial, Helvetica, sans-serif",
      maxWidth: 600,
      padding: 24,
      radius: 8,
      shadowEnabled: true,
      shadowColor: "#000000",
      shadowOpacity: 10,
      shadowBlur: 28,
      shadowSpread: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 14,
      buttonBackgroundColor: "#E05C3A",
      buttonTextColor: "#ffffff",
      secondaryButtonBackgroundColor: "#ffffff",
      secondaryButtonTextColor: "#E05C3A",
      buttonRadius: 6,
      buttonPaddingY: 14,
      buttonPaddingX: 18,
      buttonFontSize: 15,
    },
    blocks: [],
    ...overrides,
  };
}

export function createColumn(width = 1): ColumnContent {
  return {
    id: createId(),
    width,
    eyebrow: "",
    heading: "<p>Column headline</p>",
    body: "<p>Add a short description for this offer, story, or feature.</p>",
    imageSrc: "",
    imageAlt: "Column image",
    linkLabel: "Learn more",
    linkUrl: "https://example.com",
    showImage: true,
    showCta: true,
    blocks: [],
  };
}

export function createBlock(type: EmailBlock["type"]): EmailBlock {
  switch (type) {
    case "text":
      return {
        id: createId(),
        type: "text",
        eyebrow: "",
        heading: "<p>New section</p>",
        body: "<p>Write the campaign copy for this section.</p>",
        align: "left",
      };
    case "heading":
      return {
        id: createId(),
        type: "heading",
        text: "<p>Section heading</p>",
        level: 2,
        align: "left",
      };
    case "paragraph":
      return {
        id: createId(),
        type: "paragraph",
        body: "<p>Write your paragraph text here. Keep it concise and focused on one topic per paragraph.</p>",
        align: "left",
      };
    case "image":
      return {
        id: createId(),
        type: "image",
        src: "",
        alt: "Campaign image",
        width: 100,
      };
    case "button":
      return {
        id: createId(),
        type: "button",
        label: "Call to action",
        href: "",
        align: "left",
        variant: "primary",
      };
    case "divider":
      return { id: createId(), type: "divider" };
    case "spacer":
      return { id: createId(), type: "spacer", height: 24 };
    case "columns":
      return {
        id: createId(),
        type: "columns",
        columns: [createColumn(), createColumn()],
        gap: 12,
        borderStyle: "none",
        borderColor: "#e5e5e5",
        borderRadius: 6,
        valign: "top",
        mobile: "stack",
        cellPadding: 12,
      };
    case "articleCard":
      return {
        id: createId(),
        type: "articleCard",
        headline: "<p>Your first article headline</p>",
        body: "<p>Write a short summary of the story here. Keep it punchy — two or three sentences is ideal.</p>",
        imageSrc: ARTICLE_PLACEHOLDER_IMAGE,
        imageAlt: "Article image",
        imagePosition: "right",
        showCta: true,
        ctaStyle: "link",
        linkUrl: "https://example.com",
        linkLabel: "Read more",
      };
    case "rawHtml":
      return {
        id: createId(),
        type: "rawHtml",
        label: "Custom HTML",
        html: "<p>Custom HTML content.</p>",
        text: "Custom HTML content.",
      };
    case "video":
      return {
        id: createId(),
        type: "video",
        url: "",
        caption: "",
      };
    case "social":
      return {
        id: createId(),
        type: "social",
        links: [
          { id: createId(), platform: "facebook", url: "" },
          { id: createId(), platform: "twitter", url: "" },
          { id: createId(), platform: "instagram", url: "" },
        ],
        align: "center",
      };
    case "logo":
      return {
        id: createId(),
        type: "logo",
        src: "",
        alt: "Logo",
        width: 40,
        align: "center",
      };
    case "footer":
      return {
        id: createId(),
        type: "footer",
        companyName: "Your Organization",
        address: "123 Main St, City, State 12345",
      };
  }
}

// ─── Tree helpers (blocks can nest one level inside column cells) ──────────────

/** Map over the whole block tree, applying `updater` to the block with `id`. */
function mapTree(
  blocks: EmailBlock[],
  id: string,
  updater: (block: EmailBlock) => EmailBlock
): EmailBlock[] {
  return blocks.map((block) => {
    if (block.id === id) return updater(block);
    if (block.type === "columns") {
      return {
        ...block,
        columns: block.columns.map((c) => ({
          ...c,
          blocks: mapTree(c.blocks, id, updater),
        })),
      };
    }
    return block;
  });
}

/** Find a block anywhere in the tree (top-level or inside a column). */
export function findBlock(blocks: EmailBlock[], id: string): EmailBlock | undefined {
  for (const block of blocks) {
    if (block.id === id) return block;
    if (block.type === "columns") {
      for (const column of block.columns) {
        const found = findBlock(column.blocks, id);
        if (found) return found;
      }
    }
  }
  return undefined;
}

/** The sibling list + index that contains `id`, for move/duplicate context. */
export function locateBlock(
  blocks: EmailBlock[],
  id: string
): { siblings: EmailBlock[]; index: number } | undefined {
  const index = blocks.findIndex((b) => b.id === id);
  if (index >= 0) return { siblings: blocks, index };
  for (const block of blocks) {
    if (block.type === "columns") {
      for (const column of block.columns) {
        const found = locateBlock(column.blocks, id);
        if (found) return found;
      }
    }
  }
  return undefined;
}

export function updateBlock(
  document: EmailDocument,
  blockId: string,
  updater: (block: EmailBlock) => EmailBlock
): EmailDocument {
  return touchDocument({ ...document, blocks: mapTree(document.blocks, blockId, updater) });
}

export function reorderBlocks(
  document: EmailDocument,
  fromIndex: number,
  toIndex: number
): EmailDocument {
  const nextBlocks = [...document.blocks];
  const [block] = nextBlocks.splice(fromIndex, 1);
  nextBlocks.splice(toIndex, 0, block);
  return touchDocument({ ...document, blocks: nextBlocks });
}

/** Reorder blocks inside a single column cell. */
export function reorderInColumn(
  document: EmailDocument,
  columnId: string,
  fromIndex: number,
  toIndex: number
): EmailDocument {
  return touchDocument({
    ...document,
    blocks: document.blocks.map((block) => {
      if (block.type !== "columns") return block;
      return {
        ...block,
        columns: block.columns.map((c) => {
          if (c.id !== columnId) return c;
          const next = [...c.blocks];
          const [moved] = next.splice(fromIndex, 1);
          next.splice(toIndex, 0, moved);
          return { ...c, blocks: next };
        }),
      };
    }),
  });
}

/** Insert a block into a column cell at a given index. */
export function insertIntoColumn(
  document: EmailDocument,
  columnId: string,
  index: number,
  block: EmailBlock
): EmailDocument {
  return touchDocument({
    ...document,
    blocks: document.blocks.map((b) => {
      if (b.type !== "columns") return b;
      if (!b.columns.some((c) => c.id === columnId)) return b;
      return {
        ...b,
        columns: b.columns.map((c) =>
          c.id === columnId
            ? { ...c, blocks: [...c.blocks.slice(0, index), block, ...c.blocks.slice(index)] }
            : c,
        ),
      };
    }),
  });
}

/** Insert a new block at a top-level index. */
export function insertBlockAtIndex(
  document: EmailDocument,
  index: number,
  block: EmailBlock
): EmailDocument {
  return touchDocument({
    ...document,
    blocks: [...document.blocks.slice(0, index), block, ...document.blocks.slice(index)],
  });
}

/** Grow/shrink a columns block to `count` cells, preserving existing content. */
export function setColumnCount(
  document: EmailDocument,
  columnsBlockId: string,
  count: number
): EmailDocument {
  return updateBlock(document, columnsBlockId, (block) => {
    if (block.type !== "columns") return block;
    const current = block.columns;
    let next: ColumnContent[];
    if (count > current.length) {
      next = [...current, ...Array.from({ length: count - current.length }, () => createColumn())];
    } else {
      // Merge trimmed cells' blocks into the last surviving cell so nothing is lost.
      const kept = current.slice(0, count);
      const dropped = current.slice(count).flatMap((c) => c.blocks);
      next = kept.map((c, i) =>
        i === kept.length - 1 ? { ...c, blocks: [...c.blocks, ...dropped] } : c,
      );
    }
    return { ...block, columns: next.map((c) => ({ ...c, width: 1 })) };
  });
}

export function duplicateBlock(document: EmailDocument, blockId: string) {
  const dup = (blocks: EmailBlock[]): { blocks: EmailBlock[]; done: boolean } => {
    const idx = blocks.findIndex((b) => b.id === blockId);
    if (idx >= 0) {
      const next = [...blocks];
      next.splice(idx + 1, 0, cloneBlock(blocks[idx]));
      return { blocks: next, done: true };
    }
    let done = false;
    const next = blocks.map((b) => {
      if (done || b.type !== "columns") return b;
      const columns = b.columns.map((c) => {
        if (done) return c;
        const r = dup(c.blocks);
        if (r.done) {
          done = true;
          return { ...c, blocks: r.blocks };
        }
        return c;
      });
      return done ? { ...b, columns } : b;
    });
    return { blocks: next, done };
  };
  const result = dup(document.blocks);
  return result.done ? touchDocument({ ...document, blocks: result.blocks }) : document;
}

export function removeBlock(document: EmailDocument, blockId: string) {
  // Never remove the final top-level block.
  if (document.blocks.length === 1 && document.blocks[0].id === blockId) return document;
  const prune = (blocks: EmailBlock[]): EmailBlock[] =>
    blocks
      .filter((b) => b.id !== blockId)
      .map((b) =>
        b.type === "columns"
          ? { ...b, columns: b.columns.map((c) => ({ ...c, blocks: prune(c.blocks) })) }
          : b,
      );
  return touchDocument({ ...document, blocks: prune(document.blocks) });
}

export function cloneBlock(block: EmailBlock): EmailBlock {
  return reassignIds(structuredClone(block));
}

/** Recursively assign fresh ids so duplicated subtrees never collide. */
function reassignIds(block: EmailBlock): EmailBlock {
  const next = { ...block, id: createId() } as EmailBlock;
  if (next.type === "columns") {
    next.columns = next.columns.map((c) => ({
      ...c,
      id: createId(),
      blocks: c.blocks.map(reassignIds),
    }));
  }
  return next;
}

export function touchDocument(document: EmailDocument): EmailDocument {
  return { ...document, updatedAt: new Date().toISOString() };
}

export function isEmailDocument(value: unknown): value is EmailDocument {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<EmailDocument>;
  return Boolean(
    candidate.id && candidate.settings && Array.isArray(candidate.blocks)
  );
}

// ─── Migration ────────────────────────────────────────────────────────────────

/** Upgrade documents persisted before columns held nested blocks. */
export function normalizeDocument(document: EmailDocument): EmailDocument {
  const settings = {
    ...document.settings,
    linkColor: document.settings.linkColor ?? document.settings.accentColor,
    buttonBackgroundColor:
      document.settings.buttonBackgroundColor ?? document.settings.accentColor,
    buttonTextColor: document.settings.buttonTextColor ?? "#ffffff",
    secondaryButtonBackgroundColor:
      document.settings.secondaryButtonBackgroundColor ??
      document.settings.contentColor,
    secondaryButtonTextColor:
      document.settings.secondaryButtonTextColor ?? document.settings.accentColor,
    shadowEnabled: document.settings.shadowEnabled ?? true,
    shadowColor: document.settings.shadowColor ?? "#000000",
    shadowOpacity: document.settings.shadowOpacity ?? 10,
    shadowBlur: document.settings.shadowBlur ?? 28,
    shadowSpread: document.settings.shadowSpread ?? 0,
    shadowOffsetX: document.settings.shadowOffsetX ?? 0,
    shadowOffsetY: document.settings.shadowOffsetY ?? 14,
  };

  return {
    ...document,
    settings,
    blocks: document.blocks.map(normalizeBlock),
  };
}

function normalizeBlock(block: EmailBlock): EmailBlock {
  if (block.type === "button") {
    return {
      ...block,
      variant: block.variant ?? "primary",
      secondaryVariant: block.secondaryLabel
        ? block.secondaryVariant ?? "secondary"
        : block.secondaryVariant,
    };
  }

  if (block.type === "articleCard") {
    return {
      ...block,
      showCta: block.showCta ?? Boolean(block.linkUrl),
      ctaStyle: block.ctaStyle ?? "link",
    };
  }

  if (block.type !== "columns") return block;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = block as any;
  return {
    gap: 12,
    borderStyle: "none",
    borderColor: "#e5e5e5",
    borderRadius: 6,
    valign: "top",
    mobile: "stack",
    cellPadding: 12,
    ...raw,
    columns: (raw.columns ?? []).map(normalizeColumn),
  } as ColumnsBlock;
}

function normalizeColumn(column: Record<string, unknown>): ColumnContent {
  const blocks = Array.isArray(column.blocks)
    ? (column.blocks as EmailBlock[]).map(normalizeBlock)
    : legacyColumnToBlocks(column);
  const legacyHeading = blocks.find((block): block is HeadingBlock => block.type === "heading");
  const legacyParagraph = blocks.find((block): block is ParagraphBlock => block.type === "paragraph");
  const legacyImage = blocks.find((block): block is ImageBlock => block.type === "image");
  const legacyButton = blocks.find((block): block is ButtonBlock => block.type === "button");

  return {
    id: (column.id as string) ?? createId(),
    width: typeof column.width === "number" ? column.width : 1,
    eyebrow: typeof column.eyebrow === "string" ? column.eyebrow : "",
    heading:
      typeof column.heading === "string"
        ? column.heading
        : legacyHeading?.text ?? "<p>Column headline</p>",
    body:
      typeof column.body === "string"
        ? column.body
        : legacyParagraph?.body ?? "<p>Add a short description for this offer, story, or feature.</p>",
    imageSrc: typeof column.imageSrc === "string" ? column.imageSrc : legacyImage?.src ?? "",
    imageAlt:
      typeof column.imageAlt === "string"
        ? column.imageAlt
        : legacyImage?.alt ?? "Column image",
    linkLabel:
      typeof column.linkLabel === "string"
        ? column.linkLabel
        : legacyButton?.label ?? "Learn more",
    linkUrl:
      typeof column.linkUrl === "string"
        ? column.linkUrl
        : legacyButton?.href ?? "https://example.com",
    showImage:
      typeof column.showImage === "boolean"
        ? column.showImage
        : Boolean(legacyImage?.src),
    showCta:
      typeof column.showCta === "boolean"
        ? column.showCta
        : Boolean(legacyButton?.label || legacyButton?.href),
    blocks,
  };
}

function legacyColumnToBlocks(column: Record<string, unknown>): EmailBlock[] {
  const blocks: EmailBlock[] = [];
  if (typeof column.heading === "string" && column.heading.trim()) {
    blocks.push({ id: createId(), type: "heading", text: column.heading, level: 3, align: "left" });
  }
  if (typeof column.body === "string" && column.body.trim()) {
    blocks.push({ id: createId(), type: "paragraph", body: column.body, align: "left" });
  }
  return blocks;
}

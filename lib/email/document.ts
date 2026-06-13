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
  textColor: string;
  fontFamily: string;
  maxWidth: number;
  padding: number;
  radius: number;
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
};

export type ButtonBlock = BaseBlock<"button"> & {
  label: string;
  href: string;
  align: TextAlign;
};

export type DividerBlock = BaseBlock<"divider">;

export type SpacerBlock = BaseBlock<"spacer"> & {
  height: number;
};

export type ColumnsBlock = BaseBlock<"columns"> & {
  columns: ColumnContent[];
};

export type ColumnContent = {
  id: string;
  heading: string;
  body: string;
};

export type ArticleCardBlock = BaseBlock<"articleCard"> & {
  headline: string;
  body: string;
  imageSrc: string;
  imageAlt: string;
  imagePosition: "left" | "right";
  linkUrl: string;
  linkLabel: string;
};

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
  platform: "facebook" | "twitter" | "instagram" | "linkedin" | "youtube";
  url: string;
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
  unsubscribeText: string;
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
    textColor: "#1a1a1a",
    fontFamily: "Arial, Helvetica, sans-serif",
    maxWidth: 600,
    padding: 24,
    radius: 8,
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
      linkUrl: "https://example.com",
      linkLabel: "Read more",
    },
    {
      id: "block-3",
      type: "button",
      label: "Read the full newsletter",
      href: "https://example.com",
      align: "left",
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
      textColor: "#1a1a1a",
      fontFamily: "Arial, Helvetica, sans-serif",
      maxWidth: 600,
      padding: 24,
      radius: 8,
      buttonRadius: 6,
      buttonPaddingY: 14,
      buttonPaddingX: 18,
      buttonFontSize: 15,
    },
    blocks: [],
    ...overrides,
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
      };
    case "divider":
      return { id: createId(), type: "divider" };
    case "spacer":
      return { id: createId(), type: "spacer", height: 24 };
    case "columns":
      return {
        id: createId(),
        type: "columns",
        columns: [
          {
            id: createId(),
            heading: "<p>First column</p>",
            body: "<p>Add supporting copy here.</p>",
          },
          {
            id: createId(),
            heading: "<p>Second column</p>",
            body: "<p>Add supporting copy here.</p>",
          },
        ],
      };
    case "articleCard":
      return {
        id: createId(),
        type: "articleCard",
        headline: "<p>Article headline</p>",
        body: "<p>Write a short summary of this story or update.</p>",
        imageSrc: "",
        imageAlt: "Article image",
        imagePosition: "right",
        linkUrl: "",
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
        unsubscribeText: "Unsubscribe",
      };
  }
}

export function updateBlock(
  document: EmailDocument,
  blockId: string,
  updater: (block: EmailBlock) => EmailBlock
): EmailDocument {
  return touchDocument({
    ...document,
    blocks: document.blocks.map((block) =>
      block.id === blockId ? updater(block) : block
    ),
  });
}

export function moveBlock(
  document: EmailDocument,
  blockId: string,
  direction: -1 | 1
) {
  const currentIndex = document.blocks.findIndex(
    (block) => block.id === blockId
  );
  const nextIndex = currentIndex + direction;
  if (
    currentIndex < 0 ||
    nextIndex < 0 ||
    nextIndex >= document.blocks.length
  )
    return document;

  const nextBlocks = [...document.blocks];
  const [block] = nextBlocks.splice(currentIndex, 1);
  nextBlocks.splice(nextIndex, 0, block);
  return touchDocument({ ...document, blocks: nextBlocks });
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

export function duplicateBlock(document: EmailDocument, blockId: string) {
  const currentIndex = document.blocks.findIndex(
    (block) => block.id === blockId
  );
  if (currentIndex < 0) return document;

  const block = cloneBlock(document.blocks[currentIndex]);
  const nextBlocks = [...document.blocks];
  nextBlocks.splice(currentIndex + 1, 0, block);
  return touchDocument({ ...document, blocks: nextBlocks });
}

export function removeBlock(document: EmailDocument, blockId: string) {
  if (document.blocks.length === 1) return document;
  return touchDocument({
    ...document,
    blocks: document.blocks.filter((block) => block.id !== blockId),
  });
}

export function cloneBlock(block: EmailBlock): EmailBlock {
  return { ...structuredClone(block), id: createId() } as EmailBlock;
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
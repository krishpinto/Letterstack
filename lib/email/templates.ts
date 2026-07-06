// Prebuilt, customizable LetterStack templates. Each `build()` returns a fresh
// EmailDocument (new ids every time) that the templates gallery writes into the
// editor's STORAGE_KEY before navigating to /editor — so the editor loads it
// exactly like any saved draft. This file lives in lib/email (the shared core)
// and only depends on ./document, so it stays inside the module boundary.

import {
  createBlock,
  createDocument,
  type EmailBlock,
  type EmailDocument,
} from "./document";

export type TemplateCategory =
  | "newsletter"
  | "announce"
  | "welcome"
  | "product"
  | "event";

export type PrebuiltTemplate = {
  id: string;
  title: string;
  description: string;
  category: TemplateCategory;
  /** Accent hex used for the gallery card preview (matches the doc's accent). */
  accent: string;
  build: () => EmailDocument;
};

export const TEMPLATE_CATEGORIES: { key: TemplateCategory | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "newsletter", label: "Newsletter" },
  { key: "announce", label: "Announce" },
  { key: "product", label: "Sell products" },
  { key: "welcome", label: "Welcome" },
  { key: "event", label: "Invite to event" },
];

const CORAL = "#E05C3A";
const PURPLE = "#7C3AED";
const SAGE = "#2E7D5B";

const HERO = "https://placehold.co/600x300/e8e8e8/888888?text=Hero+image";
const ARTICLE = "https://placehold.co/280x180/e8e8e8/888888?text=Article";
const LOGO = "https://placehold.co/120x40/1a1a1a/ffffff?text=LOGO";

/**
 * Fill `{{organization}}` placeholders in template-provided copy (subject,
 * preview text) with the actual organization name. Templates are built without
 * knowing who is using them, so the caller resolves the name at creation time.
 */
export function resolveTemplateVariables(
  doc: EmailDocument,
  vars: { organization: string },
): EmailDocument {
  const fill = (value: string) => value.replaceAll("{{organization}}", vars.organization);
  if (doc.subject) doc.subject = fill(doc.subject);
  if (doc.settings.previewText) doc.settings.previewText = fill(doc.settings.previewText);
  return doc;
}

/** Build a block of `type` from its factory default, with a few fields overridden. */
function blk<T extends EmailBlock["type"]>(
  type: T,
  patch: Partial<Extract<EmailBlock, { type: T }>> = {},
): EmailBlock {
  return { ...createBlock(type), ...patch } as EmailBlock;
}

/** Assemble a document and apply accent/background tweaks onto the default settings. */
function buildDoc(opts: {
  name: string;
  subject: string;
  previewText?: string;
  accent?: string;
  background?: string;
  blocks: EmailBlock[];
}): EmailDocument {
  const doc = createDocument({
    name: opts.name,
    subject: opts.subject,
    blocks: opts.blocks,
  });
  if (opts.accent) {
    doc.settings.accentColor = opts.accent;
    doc.settings.linkColor = opts.accent;
    doc.settings.buttonBackgroundColor = opts.accent;
    doc.settings.secondaryButtonTextColor = opts.accent;
  }
  if (opts.background) doc.settings.backgroundColor = opts.background;
  if (opts.previewText) doc.settings.previewText = opts.previewText;
  return doc;
}

const footer = () =>
  blk("footer", {
    companyName: "Your Organization",
    address: "123 Main Street, City, State 12345",
  });

export const PREBUILT_TEMPLATES: PrebuiltTemplate[] = [
  {
    id: "monthly-newsletter",
    title: "Monthly newsletter",
    description: "Logo, intro and two article cards — the classic recurring issue.",
    category: "newsletter",
    accent: CORAL,
    build: () =>
      buildDoc({
        name: "Monthly newsletter",
        subject: "Your monthly update from {{organization}}",
        previewText: "The latest news, stories and updates.",
        accent: CORAL,
        blocks: [
          blk("logo", { src: LOGO, alt: "Logo", width: 120, align: "left" }),
          blk("text", {
            eyebrow: "Newsletter · This month",
            heading: "<p>What's new this month</p>",
            body: "<p>A short, warm intro to set up the issue. Tell readers what to expect in two sentences.</p>",
            align: "left",
          }),
          blk("articleCard", {
            headline: "<p>Lead story headline</p>",
            body: "<p>Summarize the main story in two or three punchy sentences so readers can scan it fast.</p>",
            imageSrc: ARTICLE,
            imagePosition: "right",
          }),
          blk("articleCard", {
            headline: "<p>Second story headline</p>",
            body: "<p>A secondary piece — an update, an announcement, or a quick win worth sharing this month.</p>",
            imageSrc: ARTICLE,
            imagePosition: "left",
          }),
          blk("button", { label: "Read the full issue", href: "https://example.com", align: "left" }),
          blk("divider"),
          footer(),
        ],
      }),
  },
  {
    id: "product-announcement",
    title: "Product announcement",
    description: "Big hero, a clear pitch and a single call to action.",
    category: "announce",
    accent: PURPLE,
    build: () =>
      buildDoc({
        name: "Product announcement",
        subject: "Introducing something new",
        previewText: "We just shipped something we think you'll love.",
        accent: PURPLE,
        blocks: [
          blk("heading", { text: "<p>Introducing our newest release</p>", level: 1, align: "center" }),
          blk("image", { src: HERO, alt: "Announcement hero", width: 100 }),
          blk("paragraph", {
            body: "<p>Explain what's new and why it matters in a couple of friendly sentences. Lead with the benefit, not the feature.</p>",
            align: "center",
          }),
          blk("button", { label: "See what's new", href: "https://example.com", align: "center" }),
          blk("divider"),
          footer(),
        ],
      }),
  },
  {
    id: "welcome",
    title: "Welcome email",
    description: "Greet new subscribers and point them to a first step.",
    category: "welcome",
    accent: SAGE,
    build: () =>
      buildDoc({
        name: "Welcome email",
        subject: "Welcome aboard 👋",
        previewText: "Thanks for joining — here's how to get started.",
        accent: SAGE,
        blocks: [
          blk("logo", { src: LOGO, alt: "Logo", width: 120, align: "center" }),
          blk("heading", { text: "<p>Welcome aboard 👋</p>", level: 1, align: "center" }),
          blk("paragraph", {
            body: "<p>We're glad you're here. Here's a quick note on what you can expect from us and how to get the most out of it.</p>",
            align: "center",
          }),
          blk("button", { label: "Get started", href: "https://example.com", align: "center" }),
          footer(),
        ],
      }),
  },
  {
    id: "product-spotlight",
    title: "Product spotlight",
    description: "Feature one product with an image, pitch and buy button.",
    category: "product",
    accent: CORAL,
    build: () =>
      buildDoc({
        name: "Product spotlight",
        subject: "This week's spotlight",
        previewText: "One product, worth a closer look.",
        accent: CORAL,
        blocks: [
          blk("image", { src: HERO, alt: "Product image", width: 100 }),
          blk("heading", { text: "<p>The product name</p>", level: 2, align: "left" }),
          blk("paragraph", {
            body: "<p>One short paragraph on what it is and who it's for. Keep the focus on a single, clear value.</p>",
            align: "left",
          }),
          blk("button", { label: "Shop now", href: "https://example.com", align: "left" }),
          blk("divider"),
          footer(),
        ],
      }),
  },
  {
    id: "event-invite",
    title: "Event invite",
    description: "Date, place and an RSVP — everything an invite needs.",
    category: "event",
    accent: PURPLE,
    build: () =>
      buildDoc({
        name: "Event invite",
        subject: "You're invited",
        previewText: "Save the date — here are the details.",
        accent: PURPLE,
        blocks: [
          blk("heading", { text: "<p>You're invited</p>", level: 1, align: "center" }),
          blk("paragraph", {
            body: "<p><strong>Date:</strong> Saturday, the 14th · <strong>Time:</strong> 6:00 PM<br><strong>Place:</strong> The venue, 123 Main Street</p>",
            align: "center",
          }),
          blk("button", { label: "RSVP now", href: "https://example.com", align: "center" }),
          footer(),
        ],
      }),
  },
];

/**
 * A near-blank starter — used by "Create from scratch". Seeds a heading and a
 * paragraph so the canvas shows a real starting point (the editor has no
 * empty-state placeholder, so a zero-block document renders as a blank canvas).
 */
export function blankDocument(): EmailDocument {
  return createDocument({
    name: "Untitled Campaign",
    blocks: [
      blk("heading", { text: "<p>Your heading</p>", level: 1, align: "left" }),
      blk("paragraph", {
        body: "<p>Start writing here, or add blocks from the left panel.</p>",
        align: "left",
      }),
    ],
  });
}

/** Wrap pasted/imported HTML in a single rawHtml block so it opens in the editor. */
export function documentFromHtml(html: string): EmailDocument {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return createDocument({
    name: "Imported HTML",
    blocks: [blk("rawHtml", { label: "Imported HTML", html, text })],
  });
}

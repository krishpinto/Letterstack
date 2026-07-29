// Prebuilt, customizable LetterStack templates. Each `build()` returns a fresh
// EmailDocument (new ids every time) that the templates gallery writes into the
// editor's STORAGE_KEY before navigating to /editor — so the editor loads it
// exactly like any saved draft. This file lives in lib/email (the shared core)
// and only depends on ./document, so it stays inside the module boundary.

import {
  createBlock,
  createColumn,
  createDocument,
  type ColumnContent,
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
const INK = "#1A1A1A";
const RED = "#DC2626";
const AMBER = "#B45309";

/** Unsplash CDN helper — permanent photo URLs, auto-formatted and cropped. */
const img = (id: string, w = 600) =>
  `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

// Curated, on-theme stock photography for the starter templates. These are
// placeholders the sender swaps for their own imagery, but they make the
// gallery preview read like a real, designed email rather than grey boxes.
const IMG = {
  // Fashion & retail
  boutique: img("photo-1441986300917-64674bd600d8"),
  shopper: img("photo-1483985988355-763728e1935b"),
  tees: img("photo-1523381210434-271e8be1f52b"),
  racks: img("photo-1445205170230-053b83016050"),
  sneakerWhite: img("photo-1600185365483-26d7a4cc7519"),
  sneakerRed: img("photo-1542291026-7eec264c27ff"),
  // Home & interior
  sofa: img("photo-1555041469-a586c61ea9bc"),
  lounge: img("photo-1524758631624-e2822e304c36"),
  // Work, newsletter & community
  office: img("photo-1497215728101-856f4ea42174"),
  teamLaugh: img("photo-1522202176988-66273c2fd55f"),
  teamTable: img("photo-1521737604893-d14cc237f11d"),
  cafeGroup: img("photo-1507003211169-0a1dd7228f2d"),
  cafeWork: img("photo-1543269865-cbf427effbad"),
  portrait: img("photo-1519671482749-fd09be7ccebf"),
  // Food & dining
  foodFlat: img("photo-1533174072545-7a4b6ad7a6c3"),
  dining: img("photo-1504674900247-0877df9cc836"),
  // Events
  tableSetting: img("photo-1511795409834-ef04bbd61622"),
};

const GREEN = "#0F3D2E";
const ROSE = "#D6336C";
const MAUVE = "#B0526B";
const NAVY = "#1F3A5F";
const TEAL = "#0E7C7B";
const ORANGE = "#D97706";
const CRIMSON = "#A81E1E";

const LOGO = "https://placehold.co/120x40/1a1a1a/ffffff?text=LOGO";

// Rebuilt-from-inspiration templates reuse their original artwork, served from
// the app's own public/ folder. Emails need absolute URLs, so these point at the
// deployed origin — the images render once this build is deployed.
const ASSET = "https://letterstack.site/templates";

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

/** A column cell built from its factory default, with a few fields overridden. */
function col(patch: Partial<ColumnContent>): ColumnContent {
  return { ...createColumn(), ...patch };
}

/** A row of columns from cell content, with sensible grid defaults. */
function grid(columns: ColumnContent[], gap = 16): EmailBlock {
  return blk("columns", { columns, gap, valign: "top", mobile: "stack" });
}

const CTA = "https://example.com";

export const PREBUILT_TEMPLATES: PrebuiltTemplate[] = [
  {
    id: "student-onboarding",
    title: "Student onboarding",
    description: "A warm first-week welcome — hero, numbered steps and a campus photo.",
    category: "welcome",
    accent: GREEN,
    build: () =>
      buildDoc({
        name: "Student onboarding",
        subject: "Welcome to {{organization}} — your onboarding starts here",
        previewText: "Everything you need for a smooth first week.",
        accent: GREEN,
        blocks: [
          blk("logo", { src: LOGO, alt: "Logo", width: 120, align: "center" }),
          blk("image", {
            src: `${ASSET}/onboarding/hero.jpg`,
            alt: "New students on their first day",
            width: 100,
          }),
          blk("text", {
            eyebrow: "New student onboarding",
            heading: "<p>Get ready to shine</p>",
            body: "<p>Your onboarding starts here. Everything you need for a smooth first week — your checklist, the key dates, and the people who'll help you settle in.</p>",
            align: "center",
          }),
          blk("button", { label: "Start onboarding", href: CTA, align: "center" }),
          blk("divider"),
          blk("heading", { text: "<p>Three things to do first</p>", level: 2, align: "center" }),
          grid([
            col({
              showImage: false,
              showCta: false,
              eyebrow: "Step 01",
              heading: "<p>Meet your advisor</p>",
              body: "<p>Book a 20-minute chat to map out your first semester.</p>",
            }),
            col({
              showImage: false,
              showCta: false,
              eyebrow: "Step 02",
              heading: "<p>Set up your account</p>",
              body: "<p>Activate your campus login, email and student portal.</p>",
            }),
            col({
              showImage: false,
              showCta: false,
              eyebrow: "Step 03",
              heading: "<p>Find your people</p>",
              body: "<p>Join a club or two — it's the fastest way to feel at home.</p>",
            }),
          ]),
          blk("image", {
            src: `${ASSET}/onboarding/students.jpg`,
            alt: "Students together on campus",
            width: 100,
          }),
          blk("text", {
            heading: "<p>We're here for you</p>",
            body: "<p>Questions about housing, timetables or anything else? Our student success team is one message away, all year round.</p>",
            align: "center",
          }),
          blk("button", { label: "See the full guide", href: CTA, align: "center" }),
          blk("divider"),
          blk("social", {
            align: "center",
            links: [
              { id: "s1", platform: "instagram", url: CTA },
              { id: "s2", platform: "facebook", url: CTA },
              { id: "s3", platform: "linkedin", url: CTA },
              { id: "s4", platform: "youtube", url: CTA },
            ],
          }),
          footer(),
        ],
      }),
  },
  {
    id: "gift-edit",
    title: "The gift edit",
    description: "A curated gift guide — heading, a 2x2 product grid and a help offer.",
    category: "product",
    accent: MAUVE,
    build: () =>
      buildDoc({
        name: "The gift edit",
        subject: "The perfect gift for her",
        previewText: "A curated beauty edit that makes gifting effortless.",
        accent: MAUVE,
        blocks: [
          blk("logo", { src: LOGO, alt: "Logo", width: 120, align: "center" }),
          blk("heading", { text: "<p>The perfect gift for her</p>", level: 1, align: "center" }),
          blk("paragraph", {
            body: "<p>Treat someone special to a little luxury. Our curated beauty edit makes gifting effortless — beautifully wrapped and ready to delight.</p>",
            align: "center",
          }),
          blk("button", { label: "Shop the gift edit", href: CTA, align: "center" }),
          blk("divider"),
          blk("heading", { text: "<p>This season's most-loved</p>", level: 2, align: "center" }),
          grid([
            col({
              imageSrc: `${ASSET}/gifts/serum.jpg`,
              imageAlt: "Rose facial serum",
              heading: "<p>Rose serum</p>",
              body: "<p>$34</p>",
              linkLabel: "Add to bag",
              linkUrl: CTA,
            }),
            col({
              imageSrc: `${ASSET}/gifts/brushes.jpg`,
              imageAlt: "Makeup brush duo",
              heading: "<p>Brush duo</p>",
              body: "<p>$28</p>",
              linkLabel: "Add to bag",
              linkUrl: CTA,
            }),
          ]),
          grid([
            col({
              imageSrc: `${ASSET}/gifts/cream.jpg`,
              imageAlt: "Day cream jar",
              heading: "<p>Day cream</p>",
              body: "<p>$42</p>",
              linkLabel: "Add to bag",
              linkUrl: CTA,
            }),
            col({
              imageSrc: `${ASSET}/gifts/bronzer.jpg`,
              imageAlt: "Bronzer compact",
              heading: "<p>Bronzer compact</p>",
              body: "<p>$30</p>",
              linkLabel: "Add to bag",
              linkUrl: CTA,
            }),
          ]),
          blk("text", {
            eyebrow: "Need a hand?",
            heading: "<p>Stuck on what to gift?</p>",
            body: "<p>Our beauty experts can help you find the perfect match — just tell us who it's for.</p>",
            align: "center",
          }),
          blk("button", { label: "Get gifting help", href: CTA, align: "center" }),
          blk("divider"),
          blk("social", {
            align: "center",
            links: [
              { id: "s1", platform: "instagram", url: CTA },
              { id: "s2", platform: "facebook", url: CTA },
            ],
          }),
          footer(),
        ],
      }),
  },
  {
    id: "flower-shop",
    title: "Flower shop",
    description: "A florist showcase — hero bloom, a product grid with prices and an offer.",
    category: "product",
    accent: ROSE,
    build: () =>
      buildDoc({
        name: "Flower shop",
        subject: "Beautiful flowers, artfully arranged",
        previewText: "Fresh-cut stems and hand-tied bouquets, delivered.",
        accent: ROSE,
        blocks: [
          blk("logo", { src: LOGO, alt: "Logo", width: 120, align: "center" }),
          blk("image", {
            src: `${ASSET}/flowers/hero.jpg`,
            alt: "A fresh pink tulip",
            width: 100,
          }),
          blk("heading", {
            text: "<p>Beautiful flowers, artfully arranged</p>",
            level: 1,
            align: "center",
          }),
          blk("paragraph", {
            body: "<p>Fresh-cut stems and hand-tied bouquets, delivered to your door. Brighten someone's day — or your own.</p>",
            align: "center",
          }),
          blk("button", { label: "Shop bouquets", href: CTA, align: "center" }),
          blk("divider"),
          blk("heading", { text: "<p>This week's favourites</p>", level: 2, align: "center" }),
          grid([
            col({
              imageSrc: `${ASSET}/flowers/bouquet.jpg`,
              imageAlt: "Pastel bouquet",
              heading: "<p>Pastel bouquet</p>",
              body: "<p>Starting at $45.95</p>",
              linkLabel: "Buy now",
              linkUrl: CTA,
            }),
            col({
              imageSrc: `${ASSET}/flowers/lily.jpg`,
              imageAlt: "Crimson water lily",
              heading: "<p>Crimson lily</p>",
              body: "<p>Starting at $38.00</p>",
              linkLabel: "Buy now",
              linkUrl: CTA,
            }),
          ]),
          grid([
            col({
              imageSrc: `${ASSET}/flowers/rose.jpg`,
              imageAlt: "Two-tone garden rose",
              heading: "<p>Two-tone rose</p>",
              body: "<p>Starting at $52.00</p>",
              linkLabel: "Buy now",
              linkUrl: CTA,
            }),
            col({
              imageSrc: `${ASSET}/flowers/forget-me-not.jpg`,
              imageAlt: "Blue forget-me-not",
              heading: "<p>Forget-me-not</p>",
              body: "<p>Starting at $29.95</p>",
              linkLabel: "Buy now",
              linkUrl: CTA,
            }),
          ]),
          blk("text", {
            eyebrow: "Limited time",
            heading: "<p>30% off orders over $100</p>",
            body: "<p>No code needed — the discount is applied at checkout.</p>",
            align: "center",
          }),
          blk("button", { label: "Start your order", href: CTA, align: "center" }),
          blk("divider"),
          blk("social", {
            align: "center",
            links: [
              { id: "s1", platform: "instagram", url: CTA },
              { id: "s2", platform: "facebook", url: CTA },
            ],
          }),
          footer(),
        ],
      }),
  },
  {
    id: "game-day",
    title: "Game day",
    description: "A sports countdown — hero athlete, a featured matchup and the fixtures.",
    category: "event",
    accent: NAVY,
    build: () =>
      buildDoc({
        name: "Game day",
        subject: "Born to champion — the biggest matchups are almost here",
        previewText: "Grab your seat before the season's best games sell out.",
        accent: NAVY,
        blocks: [
          blk("logo", { src: LOGO, alt: "Logo", width: 120, align: "left" }),
          blk("image", { src: `${ASSET}/gameday/hero.jpg`, alt: "Star quarterback", width: 88 }),
          blk("text", {
            eyebrow: "Game day",
            heading: "<p>Born to champion</p>",
            body: "<p>The season's biggest matchups are almost here. Grab your seat, rally your crew, and get ready for the games everyone will be talking about.</p>",
            align: "center",
          }),
          blk("button", { label: "Get tickets", href: CTA, align: "center" }),
          blk("divider"),
          blk("heading", { text: "<p>The countdown begins</p>", level: 2, align: "center" }),
          blk("articleCard", {
            headline: "<p>Don't miss these epic matchups</p>",
            body: "<p>Rivalries reignite this weekend. See the full schedule and lock in your seats before they're gone.</p>",
            imageSrc: `${ASSET}/gameday/matchup.jpg`,
            imageAlt: "Helmet-to-helmet matchup",
            imagePosition: "right",
            showCta: true,
            ctaStyle: "button",
            linkLabel: "See the schedule",
            linkUrl: CTA,
          }),
          grid([
            col({
              showImage: false,
              showCta: false,
              eyebrow: "Saturday",
              heading: "<p>Reds vs Blacks</p>",
              body: "<p>7:00 PM · Home opener</p>",
            }),
            col({
              showImage: false,
              showCta: false,
              eyebrow: "Sunday",
              heading: "<p>Golds vs Reds</p>",
              body: "<p>3:00 PM · The rematch</p>",
            }),
            col({
              showImage: false,
              showCta: false,
              eyebrow: "Monday",
              heading: "<p>Finals night</p>",
              body: "<p>8:00 PM · Who takes it all?</p>",
            }),
          ]),
          blk("button", { label: "View full fixtures", href: CTA, align: "center" }),
          blk("divider"),
          blk("social", {
            align: "center",
            links: [
              { id: "s1", platform: "instagram", url: CTA },
              { id: "s2", platform: "facebook", url: CTA },
              { id: "s3", platform: "twitter", url: CTA },
              { id: "s4", platform: "youtube", url: CTA },
            ],
          }),
          footer(),
        ],
      }),
  },
  {
    id: "cyber-monday-sale",
    title: "Cyber Monday sale",
    description: "A one-day-only sale — hero, promo code callout and a shop-by-collection grid.",
    category: "product",
    accent: RED,
    build: () =>
      buildDoc({
        name: "Cyber Monday sale",
        subject: "Cyber Monday — up to 50% off, today only",
        previewText: "Exclusive discounts you won't want to miss.",
        accent: RED,
        blocks: [
          blk("logo", { src: LOGO, alt: "Logo", width: 120, align: "center" }),
          blk("image", {
            src: `${ASSET}/sale/hero.jpg`,
            alt: "Cyber Monday sale",
            width: 90,
          }),
          blk("heading", { text: "<p>Cyber Monday is here</p>", level: 1, align: "center" }),
          blk("paragraph", {
            body: "<p>Exclusive discounts, one day only. Save up to 50% across the whole store — but be quick, every deal disappears at midnight.</p>",
            align: "center",
          }),
          blk("text", {
            eyebrow: "Cyber Monday only",
            heading: "<p>50% off with code GETOFF50</p>",
            body: "<p>Applied at checkout. Ends midnight Monday.</p>",
            align: "center",
          }),
          blk("button", { label: "Shop the sale", href: CTA, align: "center" }),
          blk("divider"),
          blk("heading", { text: "<p>Shop by collection</p>", level: 2, align: "center" }),
          grid([
            col({
              imageSrc: `${ASSET}/sale/men.jpg`,
              imageAlt: "Men's collection",
              heading: "<p>Men's</p>",
              body: "<p>Everyday staples and standout layers.</p>",
              linkLabel: "Shop men's",
              linkUrl: CTA,
            }),
            col({
              imageSrc: `${ASSET}/sale/women.jpg`,
              imageAlt: "Women's collection",
              heading: "<p>Women's</p>",
              body: "<p>New-season colour, built to last.</p>",
              linkLabel: "Shop women's",
              linkUrl: CTA,
            }),
            col({
              imageSrc: `${ASSET}/sale/kids.jpg`,
              imageAlt: "Kids' collection",
              heading: "<p>Kids'</p>",
              body: "<p>Tough, comfy and ready for anything.</p>",
              linkLabel: "Shop kids'",
              linkUrl: CTA,
            }),
          ]),
          blk("button", { label: "Shop everything", href: CTA, align: "center" }),
          blk("divider"),
          blk("social", {
            align: "center",
            links: [
              { id: "s1", platform: "instagram", url: CTA },
              { id: "s2", platform: "facebook", url: CTA },
              { id: "s3", platform: "linkedin", url: CTA },
            ],
          }),
          footer(),
        ],
      }),
  },
  {
    id: "fitness-weekly",
    title: "Fitness weekly",
    description: "A coach's weekly issue — hero, a two-workout grid and a coaching note.",
    category: "newsletter",
    accent: ORANGE,
    build: () =>
      buildDoc({
        name: "Fitness weekly",
        subject: "This week in training — two workouts you can do anywhere",
        previewText: "Consistency over intensity — plus a coach's note.",
        accent: ORANGE,
        blocks: [
          blk("logo", { src: LOGO, alt: "Logo", width: 120, align: "center" }),
          blk("image", { src: `${ASSET}/fitness/hero.jpg`, alt: "Warming up for a run", width: 100 }),
          blk("text", {
            eyebrow: "This week in training",
            heading: "<p>Running on hope</p>",
            body: "<p>Welcome back. This week it's consistency over intensity — small habits that keep you moving, plus two workouts you can do anywhere.</p>",
            align: "center",
          }),
          blk("button", { label: "Start this week's plan", href: CTA, align: "center" }),
          blk("divider"),
          blk("heading", { text: "<p>Two workouts to try</p>", level: 2, align: "center" }),
          grid([
            col({
              imageSrc: `${ASSET}/fitness/mobility.jpg`,
              imageAlt: "Mobility session",
              heading: "<p>Mobility reset</p>",
              body: "<p>10 min · recovery</p>",
              linkLabel: "Try it",
              linkUrl: CTA,
            }),
            col({
              imageSrc: `${ASSET}/fitness/strength.jpg`,
              imageAlt: "Strength session",
              heading: "<p>Core &amp; strength</p>",
              body: "<p>20 min · full body</p>",
              linkLabel: "Try it",
              linkUrl: CTA,
            }),
          ]),
          blk("text", {
            eyebrow: "Coach's note",
            heading: "<p>Consistency beats intensity</p>",
            body: "<p>Show up for ten minutes on the days you don't feel like it. Those are the ones that count — momentum is built, not found.</p>",
            align: "center",
          }),
          blk("button", { label: "Read the full note", href: CTA, align: "center" }),
          blk("divider"),
          blk("social", {
            align: "center",
            links: [
              { id: "s1", platform: "instagram", url: CTA },
              { id: "s2", platform: "facebook", url: CTA },
              { id: "s3", platform: "youtube", url: CTA },
            ],
          }),
          footer(),
        ],
      }),
  },
  {
    id: "monthly-newsletter",
    title: "Monthly newsletter",
    description: "A hero, an intro and two lead stories — the classic recurring issue.",
    category: "newsletter",
    accent: CORAL,
    build: () =>
      buildDoc({
        name: "Monthly newsletter",
        subject: "Your {{organization}} update — this month's highlights",
        previewText: "The stories, updates and moments worth catching up on.",
        accent: CORAL,
        blocks: [
          blk("logo", { src: LOGO, alt: "Logo", width: 120, align: "left" }),
          blk("image", { src: IMG.office, alt: "This month at a glance", width: 100 }),
          blk("text", {
            eyebrow: "The Monthly · Issue No. 24",
            heading: "<p>What's new this month</p>",
            body: "<p>A warm hello from the team. Here's everything we've been working on, the stories our community loved, and a few things worth your attention this month.</p>",
            align: "left",
          }),
          blk("articleCard", {
            headline: "<p>Behind our biggest update yet</p>",
            body: "<p>We rebuilt the thing you asked for most. Here's what changed, why it matters, and how to make the most of it.</p>",
            imageSrc: IMG.teamLaugh,
            imagePosition: "right",
            showCta: true,
            ctaStyle: "link",
            linkLabel: "Read the story",
            linkUrl: CTA,
          }),
          blk("articleCard", {
            headline: "<p>Meet the people behind the work</p>",
            body: "<p>A quick look at the team shipping your favourite features — and what keeps them going.</p>",
            imageSrc: IMG.teamTable,
            imagePosition: "left",
            showCta: true,
            ctaStyle: "link",
            linkLabel: "Read more",
            linkUrl: CTA,
          }),
          blk("divider"),
          blk("heading", { text: "<p>More to explore</p>", level: 3, align: "left" }),
          grid([
            col({
              imageSrc: IMG.cafeGroup,
              imageAlt: "Community spotlight",
              heading: "<p>Community spotlight</p>",
              body: "<p>How readers are putting these ideas to work.</p>",
              linkLabel: "Read",
              linkUrl: CTA,
            }),
            col({
              imageSrc: IMG.portrait,
              imageAlt: "A note from the editor",
              heading: "<p>A note from the editor</p>",
              body: "<p>Three lessons from a busy month, in two minutes.</p>",
              linkLabel: "Read",
              linkUrl: CTA,
            }),
          ]),
          blk("button", { label: "Read the full issue", href: CTA, align: "left" }),
          blk("divider"),
          blk("social", {
            align: "center",
            links: [
              { id: "s1", platform: "instagram", url: CTA },
              { id: "s2", platform: "facebook", url: CTA },
              { id: "s3", platform: "twitter", url: CTA },
            ],
          }),
          footer(),
        ],
      }),
  },
  {
    id: "cause-appeal",
    title: "Cause appeal",
    description: "A nonprofit fundraiser — hero, a story feature and clear ways to help.",
    category: "announce",
    accent: TEAL,
    build: () =>
      buildDoc({
        name: "Cause appeal",
        subject: "We fight this together — here's how you can help",
        previewText: "Every gift, hour and shared story brings us closer.",
        accent: TEAL,
        blocks: [
          blk("logo", { src: LOGO, alt: "Logo", width: 120, align: "center" }),
          blk("image", { src: `${ASSET}/cause/hero.jpg`, alt: "Our care team", width: 100 }),
          blk("text", {
            eyebrow: "Together we can",
            heading: "<p>We fight this together</p>",
            body: "<p>Every donation, every volunteer hour, every shared story brings us closer to a cure. Here's how you can make a difference this month.</p>",
            align: "center",
          }),
          blk("button", { label: "Donate now", href: CTA, align: "center" }),
          blk("divider"),
          blk("articleCard", {
            headline: "<p>Stories of hope</p>",
            body: "<p>Meet the people at the heart of our mission — survivors, carers and champions who remind us why this matters.</p>",
            imageSrc: `${ASSET}/cause/portrait.jpg`,
            imageAlt: "A survivor's portrait",
            imagePosition: "left",
            showCta: true,
            ctaStyle: "link",
            linkLabel: "Read their stories",
            linkUrl: CTA,
          }),
          blk("heading", { text: "<p>Three ways to help</p>", level: 2, align: "center" }),
          grid([
            col({
              showImage: false,
              showCta: false,
              heading: "<p>Give</p>",
              body: "<p>A one-off or monthly gift funds research and care.</p>",
            }),
            col({
              showImage: false,
              showCta: false,
              heading: "<p>Volunteer</p>",
              body: "<p>Lend your time at events and in the community.</p>",
            }),
            col({
              showImage: false,
              showCta: false,
              heading: "<p>Share</p>",
              body: "<p>Spread the word and help grow our movement.</p>",
            }),
          ]),
          blk("button", { label: "Join the cause", href: CTA, align: "center" }),
          blk("divider"),
          blk("social", {
            align: "center",
            links: [
              { id: "s1", platform: "facebook", url: CTA },
              { id: "s2", platform: "instagram", url: CTA },
              { id: "s3", platform: "twitter", url: CTA },
            ],
          }),
          footer(),
        ],
      }),
  },
  {
    id: "weekly-digest",
    title: "Weekly digest",
    description: "A scannable roundup — a short intro and three linked reads.",
    category: "newsletter",
    accent: CORAL,
    build: () =>
      buildDoc({
        name: "Weekly digest",
        subject: "5 things worth your time this week",
        previewText: "The week's best reads, in one quick scroll.",
        accent: CORAL,
        blocks: [
          blk("logo", { src: LOGO, alt: "Logo", width: 120, align: "left" }),
          blk("text", {
            eyebrow: "Weekly digest · Friday",
            heading: "<p>5 things worth your time</p>",
            body: "<p>The stories, links and ideas we couldn't stop talking about this week. Grab a coffee and dig in.</p>",
            align: "left",
          }),
          blk("articleCard", {
            headline: "<p>The trend everyone's watching</p>",
            body: "<p>What's changing, who's driving it, and what it means for you.</p>",
            imageSrc: IMG.office,
            imagePosition: "right",
            showCta: true,
            ctaStyle: "link",
            linkLabel: "Read",
            linkUrl: CTA,
          }),
          blk("articleCard", {
            headline: "<p>A five-minute read that stuck with us</p>",
            body: "<p>Short, sharp and worth your attention this week.</p>",
            imageSrc: IMG.teamTable,
            imagePosition: "left",
            showCta: true,
            ctaStyle: "link",
            linkLabel: "Read",
            linkUrl: CTA,
          }),
          blk("articleCard", {
            headline: "<p>From the community</p>",
            body: "<p>The conversation you started this week, and where it went.</p>",
            imageSrc: IMG.cafeWork,
            imagePosition: "right",
            showCta: true,
            ctaStyle: "link",
            linkLabel: "Read",
            linkUrl: CTA,
          }),
          blk("button", { label: "See the full digest", href: CTA, align: "left" }),
          blk("divider"),
          footer(),
        ],
      }),
  },
  {
    id: "plant-shop",
    title: "Plant shop sale",
    description: "A houseplant sale — hero plant, a product grid with prices and a care guide.",
    category: "product",
    accent: SAGE,
    build: () =>
      buildDoc({
        name: "Plant shop sale",
        subject: "Grow your garden, save big — up to 40% off",
        previewText: "Our best-selling houseplants are on sale this week.",
        accent: SAGE,
        blocks: [
          blk("logo", { src: LOGO, alt: "Logo", width: 120, align: "center" }),
          blk("image", { src: `${ASSET}/plants/hero.jpg`, alt: "A lush ZZ plant", width: 80 }),
          blk("text", {
            eyebrow: "Indoor plant sale",
            heading: "<p>Grow your garden, save big</p>",
            body: "<p>Bring the outdoors in. Our best-selling houseplants are up to 40% off this week — happy, healthy and ready to thrive in your space.</p>",
            align: "center",
          }),
          blk("button", { label: "Shop the sale", href: CTA, align: "center" }),
          blk("divider"),
          blk("heading", { text: "<p>Blooming beauties</p>", level: 2, align: "center" }),
          grid([
            col({
              imageSrc: `${ASSET}/plants/trio.jpg`,
              imageAlt: "Leafy trio",
              heading: "<p>Leafy trio</p>",
              body: "<p>Was $80 · Now $50</p>",
              linkLabel: "Get it now",
              linkUrl: CTA,
            }),
            col({
              imageSrc: `${ASSET}/plants/palm.jpg`,
              imageAlt: "Palm & calathea",
              heading: "<p>Palm &amp; calathea</p>",
              body: "<p>Was $80 · Now $50</p>",
              linkLabel: "Get it now",
              linkUrl: CTA,
            }),
            col({
              imageSrc: `${ASSET}/plants/fern.jpg`,
              imageAlt: "Fern duo",
              heading: "<p>Fern duo</p>",
              body: "<p>Was $80 · Now $50</p>",
              linkLabel: "Get it now",
              linkUrl: CTA,
            }),
          ]),
          blk("articleCard", {
            headline: "<p>How to care for indoor plants</p>",
            body: "<p>Five simple habits to keep your new plants thriving all year — the right light, the right water, and a little love.</p>",
            imageSrc: `${ASSET}/plants/care.jpg`,
            imageAlt: "Hands holding a potted plant",
            imagePosition: "right",
            showCta: true,
            ctaStyle: "link",
            linkLabel: "Read the guide",
            linkUrl: CTA,
          }),
          blk("button", { label: "Shop all plants", href: CTA, align: "center" }),
          blk("divider"),
          blk("social", {
            align: "center",
            links: [
              { id: "s1", platform: "instagram", url: CTA },
              { id: "s2", platform: "facebook", url: CTA },
            ],
          }),
          footer(),
        ],
      }),
  },
  {
    id: "the-lookbook",
    title: "The lookbook",
    description: "An editorial hero and a three-up product edit — for new arrivals.",
    category: "product",
    accent: INK,
    build: () =>
      buildDoc({
        name: "The lookbook",
        subject: "New season, new style",
        previewText: "Fresh arrivals, styled for the season ahead.",
        accent: INK,
        background: "#ffffff",
        blocks: [
          blk("logo", { src: LOGO, alt: "Logo", width: 120, align: "center" }),
          blk("image", { src: IMG.racks, alt: "New season collection", width: 100 }),
          blk("heading", { text: "<p>New season, new style</p>", level: 1, align: "center" }),
          blk("paragraph", {
            body: "<p>The new collection has landed. Curated pieces, considered details, and everything you need to refresh your look for the season ahead.</p>",
            align: "center",
          }),
          blk("button", { label: "Shop new arrivals", href: CTA, align: "center" }),
          blk("divider"),
          blk("heading", { text: "<p>This week's edit</p>", level: 3, align: "center" }),
          grid([
            col({
              imageSrc: IMG.tees,
              imageAlt: "Everyday essentials",
              heading: "<p>Everyday essentials</p>",
              body: "<p>From $28</p>",
              linkLabel: "Shop",
              linkUrl: CTA,
            }),
            col({
              imageSrc: IMG.boutique,
              imageAlt: "The new outerwear",
              heading: "<p>The new outerwear</p>",
              body: "<p>From $148</p>",
              linkLabel: "Shop",
              linkUrl: CTA,
            }),
            col({
              imageSrc: IMG.shopper,
              imageAlt: "Weekend edit",
              heading: "<p>Weekend edit</p>",
              body: "<p>From $64</p>",
              linkLabel: "Shop",
              linkUrl: CTA,
            }),
          ]),
          footer(),
        ],
      }),
  },
  {
    id: "flash-sale",
    title: "Flash sale",
    description: "A bold discount headline and a grid of best sellers on sale.",
    category: "product",
    accent: RED,
    build: () =>
      buildDoc({
        name: "Flash sale",
        subject: "Up to 50% off — this weekend only",
        previewText: "Our biggest sale of the season ends Sunday.",
        accent: RED,
        blocks: [
          blk("heading", { text: "<p>Up to 50% off</p>", level: 1, align: "center" }),
          blk("paragraph", {
            body: "<p>For a limited time only, save big on your wardrobe must-haves. Don't wait — these styles won't last long. Sale ends Sunday at midnight.</p>",
            align: "center",
          }),
          blk("image", { src: IMG.sneakerRed, alt: "Flash sale", width: 100 }),
          blk("button", { label: "Shop the sale", href: CTA, align: "center" }),
          blk("divider"),
          blk("heading", { text: "<p>Best sellers, now on sale</p>", level: 3, align: "center" }),
          grid([
            col({
              imageSrc: IMG.sneakerWhite,
              imageAlt: "Air Runner",
              heading: "<p>Air Runner</p>",
              body: "<p>Was $130 · <strong>Now $89</strong></p>",
              linkLabel: "Shop",
              linkUrl: CTA,
            }),
            col({
              imageSrc: IMG.tees,
              imageAlt: "Cotton tee",
              heading: "<p>The cotton tee</p>",
              body: "<p>Was $40 · <strong>Now $24</strong></p>",
              linkLabel: "Shop",
              linkUrl: CTA,
            }),
            col({
              imageSrc: IMG.boutique,
              imageAlt: "The overshirt",
              heading: "<p>The overshirt</p>",
              body: "<p>Was $120 · <strong>Now $79</strong></p>",
              linkLabel: "Shop",
              linkUrl: CTA,
            }),
          ]),
          blk("button", { label: "Shop everything", href: CTA, align: "center" }),
          footer(),
        ],
      }),
  },
  {
    id: "product-spotlight",
    title: "Product spotlight",
    description: "One product, front and centre, with its selling points and a buy button.",
    category: "product",
    accent: CORAL,
    build: () =>
      buildDoc({
        name: "Product spotlight",
        subject: "This week's spotlight — the Harbor Sofa",
        previewText: "One piece we think you'll love.",
        accent: CORAL,
        blocks: [
          blk("image", { src: IMG.sofa, alt: "The Harbor Sofa", width: 100 }),
          blk("text", {
            eyebrow: "Featured this week",
            heading: "<p>The Harbor Sofa</p>",
            body: "<p>Where your day begins and ends. Expertly crafted for deep comfort and lasting durability — a foundation piece designed to grow with you.</p>",
            align: "left",
          }),
          grid([
            col({
              showImage: false,
              showCta: false,
              heading: "<p>Free delivery</p>",
              body: "<p>On every order, right to your door.</p>",
            }),
            col({
              showImage: false,
              showCta: false,
              heading: "<p>10-year warranty</p>",
              body: "<p>Built to last, and backed for a decade.</p>",
            }),
            col({
              showImage: false,
              showCta: false,
              heading: "<p>30-night trial</p>",
              body: "<p>Love it or return it, free.</p>",
            }),
          ]),
          blk("button", { label: "Shop the Harbor Sofa", href: CTA, align: "left" }),
          blk("divider"),
          footer(),
        ],
      }),
  },
  {
    id: "day-of-observance",
    title: "Day of observance",
    description: "A commemorative day — striking hero, a story feature and ways to take part.",
    category: "announce",
    accent: CRIMSON,
    build: () =>
      buildDoc({
        name: "Day of observance",
        subject: "A day of freedom — history to be remembered",
        previewText: "Remember, reflect and move forward, together.",
        accent: CRIMSON,
        blocks: [
          blk("logo", { src: LOGO, alt: "Logo", width: 120, align: "center" }),
          blk("image", { src: `${ASSET}/freedom/hero.jpg`, alt: "A voice for change", width: 90 }),
          blk("text", {
            eyebrow: "June 19th · A day of freedom",
            heading: "<p>History to be remembered</p>",
            body: "<p>Today we honour a milestone in the journey toward freedom, and celebrate the resilience and joy of the community. Join us in remembering, reflecting and moving forward — together.</p>",
            align: "center",
          }),
          blk("button", { label: "Explore the history", href: CTA, align: "center" }),
          blk("divider"),
          blk("articleCard", {
            headline: "<p>Voices worth hearing</p>",
            body: "<p>From community leaders to everyday changemakers, these are the stories shaping our future. Take a moment to listen and learn.</p>",
            imageSrc: `${ASSET}/freedom/speaker.jpg`,
            imageAlt: "A community leader speaking",
            imagePosition: "left",
            showCta: true,
            ctaStyle: "link",
            linkLabel: "Read & watch",
            linkUrl: CTA,
          }),
          blk("heading", { text: "<p>Ways to take part</p>", level: 2, align: "center" }),
          grid([
            col({
              showImage: false,
              showCta: false,
              heading: "<p>Remember</p>",
              body: "<p>Learn the history and share it with others.</p>",
            }),
            col({
              showImage: false,
              showCta: false,
              heading: "<p>Celebrate</p>",
              body: "<p>Support community businesses and creators.</p>",
            }),
            col({
              showImage: false,
              showCta: false,
              heading: "<p>Act</p>",
              body: "<p>Volunteer, donate, and keep the momentum going.</p>",
            }),
          ]),
          blk("button", { label: "Join the observance", href: CTA, align: "center" }),
          blk("divider"),
          blk("social", {
            align: "center",
            links: [
              { id: "s1", platform: "instagram", url: CTA },
              { id: "s2", platform: "facebook", url: CTA },
              { id: "s3", platform: "twitter", url: CTA },
            ],
          }),
          footer(),
        ],
      }),
  },
  {
    id: "product-announcement",
    title: "Product announcement",
    description: "A big reveal — hero, a clear pitch, and three reasons it matters.",
    category: "announce",
    accent: PURPLE,
    build: () =>
      buildDoc({
        name: "Product announcement",
        subject: "Introducing something new",
        previewText: "We just shipped something we think you'll love.",
        accent: PURPLE,
        blocks: [
          blk("text", {
            eyebrow: "Just launched",
            heading: "<p>Introducing our newest release</p>",
            body: "<p>Months in the making, it's finally here. We built this around one idea: your time matters. Here's what's new — and why we think you'll love it.</p>",
            align: "center",
          }),
          blk("image", { src: IMG.lounge, alt: "Our newest release", width: 100 }),
          blk("button", { label: "See what's new", href: CTA, align: "center" }),
          blk("divider"),
          blk("heading", { text: "<p>Why it's different</p>", level: 3, align: "center" }),
          grid([
            col({
              showImage: false,
              showCta: false,
              heading: "<p>Faster</p>",
              body: "<p>Twice the speed, half the effort.</p>",
            }),
            col({
              showImage: false,
              showCta: false,
              heading: "<p>Simpler</p>",
              body: "<p>Everything right where you expect it.</p>",
            }),
            col({
              showImage: false,
              showCta: false,
              heading: "<p>Yours</p>",
              body: "<p>Make it work the way you do.</p>",
            }),
          ]),
          footer(),
        ],
      }),
  },
  {
    id: "seasonal-menu",
    title: "Seasonal menu",
    description: "A restaurant refresh — an appetising hero and a menu of new plates.",
    category: "announce",
    accent: AMBER,
    build: () =>
      buildDoc({
        name: "Seasonal menu",
        subject: "Our new seasonal menu is here",
        previewText: "Fresh plates, new flavours — come taste the season.",
        accent: AMBER,
        blocks: [
          blk("image", { src: IMG.dining, alt: "Our new seasonal menu", width: 100 }),
          blk("heading", { text: "<p>Our new seasonal menu</p>", level: 1, align: "center" }),
          blk("paragraph", {
            body: "<p>The season's best ingredients, reimagined. Our kitchen has been busy — here's a first taste of what's landing on your table.</p>",
            align: "center",
          }),
          blk("button", { label: "Book a table", href: CTA, align: "center" }),
          blk("divider"),
          blk("heading", { text: "<p>On the menu</p>", level: 3, align: "center" }),
          grid([
            col({
              imageSrc: IMG.foodFlat,
              imageAlt: "Small plates",
              heading: "<p>Small plates</p>",
              body: "<p>Made to share, built for the table.</p>",
              linkLabel: "See menu",
              linkUrl: CTA,
            }),
            col({
              imageSrc: IMG.dining,
              imageAlt: "Chef's mains",
              heading: "<p>Chef's mains</p>",
              body: "<p>Seasonal, local, unforgettable.</p>",
              linkLabel: "See menu",
              linkUrl: CTA,
            }),
          ]),
          footer(),
        ],
      }),
  },
  {
    id: "welcome",
    title: "Welcome email",
    description: "A warm hello for new subscribers, with what to expect next.",
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
          blk("image", { src: IMG.cafeGroup, alt: "Welcome to the community", width: 100 }),
          blk("heading", { text: "<p>Welcome aboard 👋</p>", level: 1, align: "center" }),
          blk("paragraph", {
            body: "<p>We're so glad you're here. You've just joined a community of people who care about the same things you do — and we can't wait to share what's next.</p>",
            align: "center",
          }),
          blk("button", { label: "Get started", href: CTA, align: "center" }),
          blk("divider"),
          blk("heading", { text: "<p>Here's what to expect</p>", level: 3, align: "center" }),
          grid([
            col({
              showImage: false,
              showCta: false,
              heading: "<p>Monthly stories</p>",
              body: "<p>One thoughtful issue a month. No spam, ever.</p>",
            }),
            col({
              showImage: false,
              showCta: false,
              heading: "<p>Members first</p>",
              body: "<p>Early access to everything we publish.</p>",
            }),
            col({
              showImage: false,
              showCta: false,
              heading: "<p>One-click opt-out</p>",
              body: "<p>Change your mind? Unsubscribe anytime.</p>",
            }),
          ]),
          footer(),
        ],
      }),
  },
  {
    id: "event-invite",
    title: "Event invite",
    description: "An invitation with the details, an RSVP, and a run of the evening.",
    category: "event",
    accent: PURPLE,
    build: () =>
      buildDoc({
        name: "Event invite",
        subject: "You're invited",
        previewText: "Save the date — here are the details.",
        accent: PURPLE,
        blocks: [
          blk("image", { src: IMG.tableSetting, alt: "You're invited", width: 100 }),
          blk("heading", { text: "<p>You're invited</p>", level: 1, align: "center" }),
          blk("paragraph", {
            body: "<p><strong>Saturday, the 14th</strong> · 6:00 PM<br>The Grand Hall · 123 Main Street</p>",
            align: "center",
          }),
          blk("button", { label: "RSVP now", href: CTA, align: "center" }),
          blk("divider"),
          blk("heading", { text: "<p>How the evening runs</p>", level: 3, align: "center" }),
          grid([
            col({
              showImage: false,
              showCta: false,
              heading: "<p>6:00 PM</p>",
              body: "<p>Welcome drinks &amp; mingling</p>",
            }),
            col({
              showImage: false,
              showCta: false,
              heading: "<p>7:00 PM</p>",
              body: "<p>Dinner &amp; the main programme</p>",
            }),
            col({
              showImage: false,
              showCta: false,
              heading: "<p>9:00 PM</p>",
              body: "<p>Music, dancing &amp; dessert</p>",
            }),
          ]),
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

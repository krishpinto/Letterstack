// Seeds a fictional demo workspace ("Northfield Arts Council") so every
// dashboard screen looks lived-in: ~2,400 contacts in folders, a verified
// sending domain, ten sent campaigns with delivery / open / click / bounce /
// complaint events, a scheduled and a draft campaign, saved templates, signup
// forms, suppressed addresses and one automation. Used to take the product
// screenshots on the landing page (scripts/capture-landing-screenshots.mjs).
//
//   npx tsx scripts/seed-demo-workspace.ts --confirm-host=<database host>
//
// The host check is deliberate: run it once without the flag and it prints the
// host it would write to. Development databases only, never production.
//
// Idempotent, keyed on the demo user's email. A re-run deletes the demo
// workspace (and only that: the org is found through the demo user's
// membership AND its exact name) and rebuilds it, so event timestamps are
// fresh relative to "now" -- the dashboard chart only shows the last 14 days.
// The demo user row is kept and its password reset.
//
// Local / development databases only. Every name is invented and every
// recipient address is on example.com / example.org / example.net.
import { config } from "dotenv";
config({ path: ".env.local" });

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

import { installDnsShim } from "./_dns-shim";
import * as schema from "../db/schema";
import { compileEmailDocument } from "../lib/email/compiler";
import {
  createBlock,
  createColumn,
  createDocument,
  type ColumnContent,
  type EmailBlock,
  type EmailDocument,
} from "../lib/email/document";
import { PREBUILT_TEMPLATES } from "../lib/email/templates";

export const DEMO_EMAIL = "demo@example.com";
// Never a fixed password: this script is public, so a hard-coded one would be
// a known login on any database it was ever run against. Pass DEMO_PASSWORD to
// choose one, or a random one is generated and printed at the end.
const DEMO_PASSWORD =
  process.env.DEMO_PASSWORD || crypto.randomBytes(12).toString("base64url");
const DEMO_NAME = "Maya Fernandes";
const ORG_NAME = "Northfield Arts Council";
const DOMAIN = "northfieldarts.org";
const FROM_EMAIL = `newsletter@${DOMAIN}`;
const REPLY_TO = `hello@${DOMAIN}`;
const ADDRESS = "14 Millbrook Lane, Northfield, NH 03000";
const CONTACT_COUNT = 2400;
const DAY = 86_400_000;
const HOUR = 3_600_000;

const {
  users,
  organizations,
  organizationMembers,
  sendingDomains,
  recipients,
  categories,
  recipientCategories,
  suppressedEmails,
  emailEvents,
  campaigns,
  campaignRecipients,
  emailTemplates,
  signupForms,
  automations,
} = schema;

// ─── Deterministic randomness ────────────────────────────────────────────────

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261113);
const pick = <T,>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
const chance = (p: number) => rand() < p;
const expo = (mean: number) => -Math.log(1 - rand()) * mean;

// ─── Invented people ─────────────────────────────────────────────────────────

const FIRST = `Amara Beatriz Callum Daniela Elias Fiona Gideon Hana Isidore Jun Katya Lorenzo Marisol Nadia Oskar Priya
Quentin Rosalind Samir Tamsin Ulla Viktor Wren Ximena Yusuf Zora Anselm Bronwen Cormac Delphine Emeka Freya Gabriela Hugo
Imogen Jasper Keziah Leandro Mireille Niamh Oluwaseun Petra Rafael Saoirse Tobias Una Valentina Wendell Yara Zainab Aidan
Bianca Cyrus Dalia Esme Felix Greta Hector Ines Joaquin Kavita Linnea Matteo Noor Odette Pascal Renata Stellan Thea
Umberto Vera Willa Xavier Yelena Zoltan Anneke Bastian Celeste Dmitri Elodie Finnian Giulia Henrik Ingrid Jerome Kasia
Lucian Maren Nikolai Ottilie Phoebe Ravi Sunniva Tariq Ursula Vesna Winifred Yannick Zeynep Ansel Briony Cassius Dorothea
Edith Florian Hollis Ilse Jules Kwame Leila Mattias Nell Orla Piers Remy Sadie Teodor Uma Wilhelmina Yoshi Zelda`
  .split(/\s+/)
  .filter(Boolean);

const LAST = `Abernethy Bellweather Castellan Dunmore Everhart Fairbrother Galbraith Hollowell Ibarra Jankowski Kowalczyk
Lindqvist Marchetti Nakagawa Oyelaran Pemberton Quarrington Ravenscroft Sandoval Thackeray Underhill Vandermeer Whitlock
Yardley Zielinski Ashdown Brightwater Cavanagh Delacroix Eastwood Farnsworth Grimaldi Haverford Iversen Jessamy Kilbride
Lockhart Mendoza Northcott Okonkwo Prescott Quillfeather Rosenthal Sutherland Tennyson Ulverston Vickery Wexford
Yamamoto Zimmerman Aldridge Beaumont Calloway Drummond Ellsworth Fitzgerald Gallagher Hargrove Ingleby Jorgensen
Kirkpatrick Lundgren Moreau Novak Ogilvie Pettigrew Radcliffe Strand Trevelyan Utterback Valdez Winslow Yeoman Zahar
Ainsworth Birtwistle Carmichael Dalgleish Eriksen Fontaine Gunnarsson Halloran Iyer Jovanovic Karlsson Laurent`
  .split(/\s+/)
  .filter(Boolean);

const PRESS_DOMAINS = ["harbourgazette.example.com", "northfieldledger.example.org", "artsquarterly.example.net", "valleyradio.example.org"];
const PERSONAL_DOMAINS = ["example.com", "example.com", "example.org", "example.net"];

// ─── Folders ─────────────────────────────────────────────────────────────────

const FOLDERS = ["Members", "Volunteers", "Donors", "Workshop alumni", "Press"] as const;
type Folder = (typeof FOLDERS)[number];

type Contact = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  folders: Folder[];
  engagement: number;
  /** Index of the campaign this address first bounced on, if it is a "bad" one. */
  bounceAt: number | null;
  complains: boolean;
  /** When they unsubscribed (suppressed from then on), if they did. */
  unsubAt: Date | null;
  manualSuppressed: boolean;
  lastSentAt: Date | null;
};

function buildContacts(now: number): Contact[] {
  const out: Contact[] = [];
  const seen = new Set<string>();

  const makeEmail = (first: string, last: string, domain: string) => {
    const f = first.toLowerCase().replace(/[^a-z]/g, "");
    const l = last.toLowerCase().replace(/[^a-z]/g, "");
    const style = Math.floor(rand() * 4);
    let local = style === 0 ? `${f}.${l}` : style === 1 ? `${f}${l}` : style === 2 ? `${f[0]}.${l}` : `${f}_${l}`;
    let email = `${local}@${domain}`;
    let n = 2;
    while (seen.has(email)) {
      local = `${f}.${l}${n++}`;
      email = `${local}@${domain}`;
    }
    seen.add(email);
    return email;
  };

  // When each contact joined. Slow growth over ~14 months, with a deliberate
  // bump in the last fortnight so the dashboard trend reads "up vs last week".
  const NEW_LAST_7 = 41;
  const NEW_PREV_7 = 30;
  const ages: number[] = [];
  for (let i = 0; i < NEW_LAST_7; i++) ages.push(rand() * 6.8 * DAY + 0.1 * DAY);
  for (let i = 0; i < NEW_PREV_7; i++) ages.push(7.2 * DAY + rand() * 6.6 * DAY);
  while (ages.length < CONTACT_COUNT) ages.push(14.5 * DAY + 420 * DAY * Math.pow(rand(), 0.85));

  for (let i = 0; i < CONTACT_COUNT; i++) {
    const press = i % 40 === 0; // ~60 press contacts
    const first = pick(FIRST);
    const last = pick(LAST);
    const domain = press ? pick(PRESS_DOMAINS) : pick(PERSONAL_DOMAINS);

    const folders: Folder[] = [];
    if (press) {
      folders.push("Press");
    } else {
      const r = rand();
      folders.push(r < 0.56 ? "Members" : r < 0.72 ? "Volunteers" : r < 0.88 ? "Donors" : "Workshop alumni");
      // Many people sit in two folders: members who volunteer or give.
      if (chance(0.22)) {
        const extra = pick(["Members", "Volunteers", "Donors", "Workshop alumni"] as const);
        if (!folders.includes(extra)) folders.push(extra);
      }
    }

    const e = rand();
    out.push({
      id: crypto.randomUUID(),
      email: makeEmail(first, last, domain),
      name: `${first} ${last}`,
      createdAt: new Date(now - ages[i]),
      folders,
      engagement: e < 0.3 ? 0.35 : e < 0.75 ? 1 : 1.6,
      bounceAt: null,
      complains: false,
      unsubAt: null,
      manualSuppressed: false,
      lastSentAt: null,
    });
  }
  return out;
}

// ─── Campaign plan ───────────────────────────────────────────────────────────

type Plan = {
  daysAgo: number;
  name: string;
  subject: string;
  folders: Folder[];
  open: number; // target unique-open rate over delivered
  click: number; // target unique-click rate over delivered
  kind: "monthly" | "event" | "appeal" | "digest";
};

const PLANS: Plan[] = [
  { daysAgo: 86, name: "Autumn Season Announcement", subject: "Autumn at Northfield: exhibitions, workshops and a new studio", folders: ["Members", "Volunteers", "Donors", "Workshop alumni"], open: 0.39, click: 0.041, kind: "monthly" },
  { daysAgo: 74, name: "Volunteer Open Evening: Save the Date", subject: "Join us on the 12th: volunteer open evening", folders: ["Volunteers"], open: 0.54, click: 0.082, kind: "event" },
  { daysAgo: 63, name: "Gallery Walk: Meet the Artists", subject: "Meet the artists behind the Autumn Group Show", folders: ["Members", "Donors"], open: 0.43, click: 0.057, kind: "event" },
  { daysAgo: 53, name: "September Newsletter", subject: "Members' Monthly: September at Northfield", folders: ["Members"], open: 0.45, click: 0.049, kind: "monthly" },
  { daysAgo: 44, name: "Call for Submissions: Winter Group Show", subject: "Open call: submit work for the Winter Group Show", folders: ["Members", "Workshop alumni", "Press"], open: 0.37, click: 0.066, kind: "digest" },
  { daysAgo: 34, name: "Annual Appeal: Support Studio Access", subject: "Help us keep the studios open to everyone", folders: ["Donors", "Members"], open: 0.47, click: 0.088, kind: "appeal" },
  { daysAgo: 24, name: "October Newsletter", subject: "Members' Monthly: October at Northfield", folders: ["Members"], open: 0.46, click: 0.052, kind: "monthly" },
  { daysAgo: 12, name: "Autumn Fundraiser Gala Invitation", subject: "You're invited: the Northfield Autumn Gala", folders: ["Members", "Volunteers", "Donors", "Workshop alumni", "Press"], open: 0.44, click: 0.071, kind: "event" },
  { daysAgo: 6, name: "Workshop Series Opens for Booking", subject: "Winter workshops are now open for booking", folders: ["Members", "Workshop alumni", "Volunteers"], open: 0.49, click: 0.075, kind: "digest" },
  { daysAgo: 2, name: "November Newsletter", subject: "Members' Monthly: November at Northfield", folders: ["Members"], open: 0.44, click: 0.054, kind: "monthly" },
];

// ─── Email documents ─────────────────────────────────────────────────────────

const U = (id: string, w = 1200) => `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;
const PHOTO = {
  hero: "https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=1200&h=520&q=80&auto=format&fit=crop", // bright abstract canvas, wide crop
  gallery: U("photo-1518998053901-5348d3961a04", 800), // empty gallery hall
  brushes: U("photo-1513364776144-60967b0f800f", 800), // paint and brushes
  palette: U("photo-1460661419201-fd4cecdf8a8b", 800), // worn brushes
  mural: U("photo-1547891654-e66ed7ebb968", 800), // street mural
  dark: U("photo-1536924940846-227afb31e2a5", 1200), // dark abstract
};
const TEAL = "#1F5F5B";
const PAPER = "#F3EFE8";
const CTA = `https://${DOMAIN}`;

function blk<T extends EmailBlock["type"]>(type: T, patch: Partial<Extract<EmailBlock, { type: T }>> = {}): EmailBlock {
  return { ...createBlock(type), ...patch } as EmailBlock;
}
function col(patch: Partial<ColumnContent>): ColumnContent {
  return { ...createColumn(), ...patch };
}

type IssueCopy = {
  name: string;
  subject: string;
  preview: string;
  eyebrow: string;
  heading: string;
  intro: string;
  hero: string;
  story1: { headline: string; body: string; link: string };
  story2: { headline: string; body: string; link: string };
  more: [{ heading: string; body: string }, { heading: string; body: string }];
  cta: string;
};

/** The polished house newsletter: hero, intro, two lead stories, a two-up row, a CTA. */
function issueDoc(c: IssueCopy): EmailDocument {
  const doc = createDocument({
    name: c.name,
    subject: c.subject,
    fromName: ORG_NAME,
    fromEmail: FROM_EMAIL,
    blocks: [
      blk("image", { src: c.hero, alt: "Colour and texture from the Autumn Group Show", width: 100 }),
      blk("text", {
        eyebrow: c.eyebrow,
        heading: `<p>${c.heading}</p>`,
        body: `<p>${c.intro}</p>`,
        align: "left",
      }),
      blk("articleCard", {
        headline: `<p>${c.story1.headline}</p>`,
        body: `<p>${c.story1.body}</p>`,
        imageSrc: PHOTO.gallery,
        imageAlt: "The main gallery hall",
        imagePosition: "right",
        showCta: true,
        ctaStyle: "link",
        linkLabel: c.story1.link,
        linkUrl: CTA,
      }),
      blk("articleCard", {
        headline: `<p>${c.story2.headline}</p>`,
        body: `<p>${c.story2.body}</p>`,
        imageSrc: PHOTO.brushes,
        imageAlt: "Paint and brushes in the studio",
        imagePosition: "left",
        showCta: true,
        ctaStyle: "link",
        linkLabel: c.story2.link,
        linkUrl: CTA,
      }),
      blk("divider"),
      blk("heading", { text: "<p>Also this month</p>", level: 3, align: "left" }),
      blk("columns", {
        columns: [
          col({ imageSrc: PHOTO.mural, imageAlt: "A mural in progress", heading: `<p>${c.more[0].heading}</p>`, body: `<p>${c.more[0].body}</p>`, linkLabel: "Read more", linkUrl: CTA }),
          col({ imageSrc: PHOTO.palette, imageAlt: "Brushes on the studio table", heading: `<p>${c.more[1].heading}</p>`, body: `<p>${c.more[1].body}</p>`, linkLabel: "Read more", linkUrl: CTA }),
        ],
        gap: 16,
        valign: "top",
        mobile: "stack",
      }),
      blk("button", { label: c.cta, href: CTA, align: "left" }),
      blk("divider"),
      blk("social", {
        align: "center",
        links: [
          { id: "s1", platform: "instagram", url: CTA },
          { id: "s2", platform: "facebook", url: CTA },
          { id: "s3", platform: "youtube", url: CTA },
        ],
      }),
      blk("footer", { companyName: ORG_NAME, address: ADDRESS }),
    ],
  });
  doc.settings.previewText = c.preview;
  doc.settings.backgroundColor = PAPER;
  doc.settings.accentColor = TEAL;
  doc.settings.linkColor = TEAL;
  doc.settings.buttonBackgroundColor = TEAL;
  doc.settings.secondaryButtonTextColor = TEAL;
  return doc;
}

function monthlyIssue(month: string, n: number, lead: Partial<IssueCopy> = {}): EmailDocument {
  return issueDoc({
    name: `Members' Monthly: ${month}`,
    subject: `Members' Monthly: ${month} at Northfield`,
    preview: "Openings, workshops and the people making it happen.",
    eyebrow: `Members' Monthly · Issue No. ${n}`,
    heading: "What's on at Northfield this season",
    intro:
      "A warm hello from all of us at the Council. The galleries are full of colour, the studios are booked solid and the volunteer team has been busy. Here is everything worth knowing this month.",
    hero: PHOTO.hero,
    story1: {
      headline: "The Autumn Group Show opens on Friday",
      body: "Forty local artists, one hall, and a few surprises. Members get first look from 5pm, with a glass of something warm on the house.",
      link: "See the exhibition",
    },
    story2: {
      headline: "Eight new studio workshops this winter",
      body: "Printmaking, life drawing, ceramics for beginners and more. Member places open a week before the public, and last year's classes filled fast.",
      link: "Browse the workshops",
    },
    more: [
      { heading: "Volunteer spotlight", body: "Meet the team who hang every show, and how to join them." },
      { heading: "From the archive", body: "Forty years of Northfield posters, now on display in the foyer." },
    ],
    cta: "Reserve your place",
    ...lead,
  });
}

/** Brand a prebuilt template (footer, sender, no placeholder logo) for the Council. */
function brandPrebuilt(templateId: string, name: string, subject: string): EmailDocument {
  const t = PREBUILT_TEMPLATES.find((p) => p.id === templateId);
  if (!t) throw new Error(`Prebuilt template not found: ${templateId}`);
  const doc = t.build();
  doc.name = name;
  doc.subject = subject;
  doc.fromName = ORG_NAME;
  doc.fromEmail = FROM_EMAIL;
  doc.settings.previewText = doc.settings.previewText.replaceAll("{{organization}}", ORG_NAME);
  doc.blocks = doc.blocks
    .filter((b) => b.type !== "logo")
    .map((b) => (b.type === "footer" ? { ...b, companyName: ORG_NAME, address: ADDRESS } : b));
  return doc;
}

function docForPlan(p: Plan, i: number): EmailDocument {
  switch (p.kind) {
    case "event":
      return brandPrebuilt("event-invite", p.name, p.subject);
    case "appeal":
      return brandPrebuilt("cause-appeal", p.name, p.subject);
    case "digest":
      return brandPrebuilt("weekly-digest", p.name, p.subject);
    default:
      return monthlyIssue(p.name.replace(" Newsletter", ""), 28 + i, { name: p.name, subject: p.subject });
  }
}

// ─── Chunked insert ──────────────────────────────────────────────────────────

async function insertChunked<T>(rows: T[], size: number, run: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) await run(rows.slice(i, i + size));
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing (.env.local)");

  // This writes a login and thousands of rows. Make the operator name the
  // database host they mean, so it can never run against the wrong one by
  // accident (for example a .env.local that points at production).
  const host = new URL(process.env.DATABASE_URL).hostname;
  const confirmed = process.argv
    .find((a) => a.startsWith("--confirm-host="))
    ?.slice("--confirm-host=".length);
  if (confirmed !== host) {
    throw new Error(
      `Refusing to seed. This would write to ${host}.
` +
        `Use a development database only, and re-run with --confirm-host=${host}`,
    );
  }

  installDnsShim();
  const db = drizzle({ client: neon(process.env.DATABASE_URL) });
  const now = Date.now();

  // ── 1. The demo user, and a clean slate for its workspace ──────────────────
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  let [user] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);

  if (user) {
    const memberships = await db
      .select({ orgId: organizationMembers.organizationId, name: organizations.name })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
      .where(eq(organizationMembers.userId, user.id));
    const foreign = memberships.filter((m) => m.name !== ORG_NAME);
    if (foreign.length > 0) {
      throw new Error(`${DEMO_EMAIL} belongs to a workspace that is not the demo one; refusing to touch it.`);
    }
    const orgIds = memberships.map((m) => m.orgId);
    if (orgIds.length > 0) {
      console.log(`Removing ${orgIds.length} previous demo workspace(s)...`);
      // email_events has no FK to campaigns, and suppressed_emails only nulls its
      // org on delete, so both are cleared by hand.
      await db.execute(sql`delete from email_events where campaign_id in (select id from campaigns where organization_id in (${sql.join(orgIds.map((id) => sql`${id}::uuid`), sql`, `)}))`);
      await db.delete(suppressedEmails).where(inArray(suppressedEmails.organizationId, orgIds));
      await db.delete(organizations).where(inArray(organizations.id, orgIds));
    }
    await db
      .update(users)
      .set({ name: DEMO_NAME, passwordHash, emailVerifiedAt: new Date(now - 120 * DAY), planNoticeSeenAt: new Date(now - 100 * DAY), accessStatus: "approved" })
      .where(eq(users.id, user.id));
  } else {
    [user] = await db
      .insert(users)
      .values({
        email: DEMO_EMAIL,
        name: DEMO_NAME,
        passwordHash,
        accessStatus: "approved",
        emailVerifiedAt: new Date(now - 120 * DAY),
        planNoticeSeenAt: new Date(now - 100 * DAY),
        createdAt: new Date(now - 120 * DAY),
      })
      .returning();
  }
  const userId = user.id;

  const [takenDomain] = await db.select().from(sendingDomains).where(eq(sendingDomains.domain, DOMAIN)).limit(1);
  if (takenDomain) throw new Error(`${DOMAIN} is already attached to another workspace.`);

  // ── 2. Workspace: paid Pro, so no trial banner / announcement ──────────────
  const contacts = buildContacts(now);
  const sentPlans = PLANS.map((p) => ({ ...p, sentAt: new Date(now - p.daysAgo * DAY + (10 * HOUR - (now % DAY)) % DAY) }));
  // Sends go out mid-morning UTC on their day; make sure none lands in the future.
  for (const p of sentPlans) {
    const t = new Date(now - p.daysAgo * DAY);
    t.setUTCHours(10, 5 + Math.floor(rand() * 40), 0, 0);
    p.sentAt = t;
    if (p.sentAt.getTime() > now - 3 * HOUR) p.sentAt = new Date(now - 3 * HOUR);
  }

  const monthStart = new Date(Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), 1));

  const [org] = await db
    .insert(organizations)
    .values({
      name: ORG_NAME,
      type: "business",
      plan: "pro",
      planSource: "paid",
      planExpiresAt: new Date(now + 290 * DAY),
      emailsSentPeriodStart: monthStart,
      defaultFromName: ORG_NAME,
      defaultReplyTo: REPLY_TO,
      createdAt: new Date(now - 118 * DAY),
    })
    .returning();
  const orgId = org.id;
  await db.insert(organizationMembers).values({ organizationId: orgId, userId, role: "owner", createdAt: new Date(now - 118 * DAY) });
  await db.insert(sendingDomains).values({ organizationId: orgId, domain: DOMAIN, verifiedAt: new Date(now - 110 * DAY), createdAt: new Date(now - 112 * DAY) });

  // ── 3. Folders and contacts ────────────────────────────────────────────────
  const folderIds = new Map<Folder, string>();
  const folderRows = FOLDERS.map((name, i) => {
    const id = crypto.randomUUID();
    folderIds.set(name, id);
    return { id, organizationId: orgId, name, createdAt: new Date(now - (116 - i) * DAY) };
  });
  await db.insert(categories).values(folderRows);

  // Pick who bounces / complains / unsubscribes before anyone is mailed. A
  // bounced or complained address is suppressed from then on, so it appears in
  // no later campaign.
  const pool = contacts.filter((c) => !c.folders.includes("Press") && c.createdAt.getTime() < now - 100 * DAY);
  const take = (n: number) => {
    const picked: Contact[] = [];
    while (picked.length < n) {
      const c = pick(pool);
      if (c.bounceAt === null && !c.complains && !c.unsubAt && !c.manualSuppressed && !picked.includes(c)) picked.push(c);
    }
    return picked;
  };
  for (const c of take(16)) c.bounceAt = 1 + Math.floor(rand() * 8); // never the first send
  for (const c of take(4)) c.complains = true;
  for (const c of take(14)) c.unsubAt = new Date(sentPlans[2 + Math.floor(rand() * 7)].sentAt.getTime() + (2 + rand() * 30) * HOUR);
  for (const c of take(2)) c.manualSuppressed = true;
  // Complaints land on a fixed campaign, then suppress.
  const complaintCampaign = new Map<string, number>();
  for (const c of contacts.filter((x) => x.complains)) complaintCampaign.set(c.id, 3 + Math.floor(rand() * 6));

  // Contacts go in with their final lastSentAt, filled in while building campaigns.
  const targetsByCampaign: Contact[][] = [];
  const cutoffs = sentPlans.map((p) => p.sentAt.getTime() - 2 * HOUR);

  sentPlans.forEach((p, i) => {
    const aud = contacts.filter((c) => {
      if (c.createdAt.getTime() > cutoffs[i]) return false;
      if (!c.folders.some((f) => p.folders.includes(f))) return false;
      if (c.bounceAt !== null && c.bounceAt < i) return false;
      const cc = complaintCampaign.get(c.id);
      if (cc !== undefined && cc < i) return false;
      if (c.unsubAt && c.unsubAt.getTime() < p.sentAt.getTime()) return false;
      if (c.manualSuppressed) return false;
      return true;
    });
    targetsByCampaign.push(aud);
    for (const c of aud) c.lastSentAt = p.sentAt;
  });

  console.log(`Inserting ${contacts.length} contacts...`);
  await insertChunked(contacts, 1000, (chunk) =>
    db.insert(recipients).values(
      chunk.map((c) => ({ id: c.id, organizationId: orgId, userId, email: c.email, name: c.name, sentAt: c.lastSentAt, createdAt: c.createdAt })),
    ),
  );
  const links = contacts.flatMap((c) => c.folders.map((f) => ({ recipientId: c.id, categoryId: folderIds.get(f)!, createdAt: c.createdAt })));
  await insertChunked(links, 2000, (chunk) => db.insert(recipientCategories).values(chunk));

  // ── 4. Saved templates ─────────────────────────────────────────────────────
  const tplDocs: { name: string; subject: string; doc: EmailDocument; updated: number }[] = [
    { name: "Members' Monthly", subject: "Members' Monthly: {{month}} at Northfield", doc: monthlyIssue("November", 38), updated: 3 },
    { name: "Event invitation", subject: "You're invited", doc: brandPrebuilt("event-invite", "Event invitation", "You're invited"), updated: 9 },
    { name: "Donor appeal", subject: "Help us keep the studios open", doc: brandPrebuilt("cause-appeal", "Donor appeal", "Help us keep the studios open"), updated: 21 },
    { name: "Welcome new members", subject: "Welcome to Northfield Arts Council", doc: brandPrebuilt("welcome", "Welcome new members", "Welcome to Northfield Arts Council"), updated: 40 },
  ];
  const tplRows = tplDocs.map((t) => ({
    id: crypto.randomUUID(),
    organizationId: orgId,
    name: t.name,
    subject: t.subject,
    fromName: ORG_NAME,
    fromEmail: FROM_EMAIL,
    document: t.doc,
    createdAt: new Date(now - (t.updated + 30) * DAY),
    updatedAt: new Date(now - t.updated * DAY),
  }));
  await db.insert(emailTemplates).values(tplRows);
  const welcomeTemplateId = tplRows[3].id;

  // ── 5. Sent campaigns, their recipients and events ─────────────────────────
  type EventRow = { email: string; type: string; campaignId: string; createdAt: Date };
  const events: EventRow[] = [];
  const crRows: { campaignId: string; recipientId: string; email: string; name: string | null; status: string; sentAt: Date | null }[] = [];
  const suppressed: { organizationId: string; userId: string; email: string; reason: string; createdAt: Date }[] = [];
  const latestCutoff = now - 2 * 60_000;
  const sentCampaignIds: string[] = [];
  const campaignRows: (typeof campaigns.$inferInsert)[] = [];

  sentPlans.forEach((p, i) => {
    const id = crypto.randomUUID();
    sentCampaignIds.push(id);
    const doc = docForPlan(p, i);
    doc.fromEmail = FROM_EMAIL;
    const { html, text } = compileEmailDocument(doc);
    campaignRows.push({
      id,
      organizationId: orgId,
      userId,
      name: p.name,
      subject: p.subject,
      fromName: ORG_NAME,
      fromEmail: FROM_EMAIL,
      replyTo: REPLY_TO,
      senderType: "domain",
      document: doc,
      htmlSnapshot: html,
      textSnapshot: text,
      status: "sent",
      createdAt: new Date(p.sentAt.getTime() - 6 * HOUR),
      sentAt: p.sentAt,
    });

    const aud = targetsByCampaign[i];
    // Normalise per-contact engagement so the campaign lands on its target rate.
    const meanEng = aud.reduce((s, c) => s + c.engagement, 0) / aud.length;
    const spread = Math.min(10 * 60_000, aud.length * 400); // sends trickle out over minutes
    const sentAtMs = p.sentAt.getTime();

    for (const c of aud) {
      const at = new Date(sentAtMs + rand() * spread);
      crRows.push({ campaignId: id, recipientId: c.id, email: c.email, name: c.name, status: "sent", sentAt: at });
      const push = (type: string, ts: number) => {
        if (ts <= latestCutoff) events.push({ email: c.email, type, campaignId: id, createdAt: new Date(ts) });
      };

      if (c.bounceAt === i) {
        const ts = at.getTime() + 2000 + rand() * 20_000;
        push("Bounce", ts);
        suppressed.push({ organizationId: orgId, userId, email: c.email, reason: "bounce", createdAt: new Date(ts) });
        continue;
      }
      const deliveredAt = at.getTime() + 1500 + rand() * 9000;
      push("Delivery", deliveredAt);

      const pOpen = Math.min(0.97, (p.open * c.engagement) / meanEng);
      const complaintHere = complaintCampaign.get(c.id) === i;
      const opened = complaintHere || chance(pOpen);
      if (!opened) continue;

      // First open is front-loaded into the hours after sending.
      let firstDelay = expo(7 * HOUR) + 20_000;
      if (firstDelay > 4 * DAY) firstDelay = rand() * 2 * DAY;
      const firstOpen = deliveredAt + firstDelay;
      push("Open", firstOpen);
      // Some people open again later (mail apps, forwarding, second device).
      if (chance(0.3)) push("Open", firstOpen + expo(18 * HOUR) + 60_000);
      if (chance(0.1)) push("Open", firstOpen + expo(40 * HOUR) + 600_000);

      const pClickGivenOpen = Math.min(0.9, (p.click / p.open) * (c.engagement > 1 ? 1.5 : c.engagement < 1 ? 0.5 : 1));
      if (chance(pClickGivenOpen * 0.93)) {
        const clickAt = firstOpen + 20_000 + expo(6 * 60_000);
        push("Click", clickAt);
        if (chance(0.22)) push("Click", clickAt + 60_000 + expo(2 * HOUR));
      }
      if (complaintHere) {
        const ts = firstOpen + 3 * HOUR + rand() * 20 * HOUR;
        push("Complaint", ts);
        suppressed.push({ organizationId: orgId, userId, email: c.email, reason: "complaint", createdAt: new Date(ts) });
      }
    }
  });

  // Unsubscribes and the two manual suppressions.
  for (const c of contacts) {
    if (c.unsubAt && c.unsubAt.getTime() < latestCutoff) suppressed.push({ organizationId: orgId, userId, email: c.email, reason: "unsubscribe", createdAt: c.unsubAt });
    if (c.manualSuppressed) suppressed.push({ organizationId: orgId, userId, email: c.email, reason: "manual", createdAt: new Date(now - 20 * DAY) });
  }

  // ── 6. Scheduled + draft campaigns ─────────────────────────────────────────
  const scheduledAt = new Date(now + 4 * DAY);
  scheduledAt.setUTCHours(10, 0, 0, 0);
  const scheduledId = crypto.randomUUID();
  const draftId = crypto.randomUUID();
  const schedDoc = brandPrebuilt("event-invite", "Winter Holiday Market: Stallholder Call", "Stalls are open for the Northfield Winter Holiday Market");
  const draftDoc = monthlyIssue("December", 39, {
    heading: "Winter at Northfield",
    story1: { headline: "The Winter Holiday Market is coming", body: "Forty stalls of handmade gifts in the main hall, with a Members' preview hour on the Friday evening.", link: "Plan your visit" },
  });
  for (const d of [schedDoc, draftDoc]) d.fromEmail = FROM_EMAIL;
  const s = compileEmailDocument(schedDoc);
  const d = compileEmailDocument(draftDoc);
  campaignRows.push(
    {
      id: scheduledId, organizationId: orgId, userId, name: "Winter Holiday Market: Stallholder Call",
      subject: "Stalls are open for the Northfield Winter Holiday Market", fromName: ORG_NAME, fromEmail: FROM_EMAIL, replyTo: REPLY_TO,
      senderType: "domain", document: schedDoc, htmlSnapshot: s.html, textSnapshot: s.text, status: "scheduled",
      createdAt: new Date(now - 52 * DAY), scheduledAt,
    },
    {
      id: draftId, organizationId: orgId, userId, name: "December Newsletter (draft)",
      subject: "Members' Monthly: December at Northfield", fromName: ORG_NAME, fromEmail: FROM_EMAIL, replyTo: REPLY_TO,
      senderType: "domain", document: draftDoc, htmlSnapshot: d.html, textSnapshot: d.text, status: "draft",
      createdAt: new Date(now - 50 * DAY),
    },
  );
  const live = contacts.filter((c) => !c.manualSuppressed && c.bounceAt === null && !c.complains && !c.unsubAt);
  const pendingFor = (id: string, folders: Folder[]) =>
    live.filter((c) => c.folders.some((f) => folders.includes(f))).map((c) => ({ campaignId: id, recipientId: c.id, email: c.email, name: c.name, status: "pending", sentAt: null }));
  crRows.push(...pendingFor(scheduledId, ["Members", "Workshop alumni", "Donors"]), ...pendingFor(draftId, ["Members"]));

  // Monthly send counter (what the settings meter reads).
  const sentThisMonth = crRows.filter((r) => r.status === "sent" && r.sentAt && r.sentAt >= monthStart).length;
  await db.update(organizations).set({ emailsSentCount: sentThisMonth }).where(eq(organizations.id, orgId));

  console.log(`Inserting ${campaignRows.length} campaigns, ${crRows.length} campaign recipients, ${events.length} events...`);
  await insertChunked(campaignRows, 4, (chunk) => db.insert(campaigns).values(chunk));
  await insertChunked(crRows, 2500, (chunk) => db.insert(campaignRecipients).values(chunk));
  await insertChunked(events, 4000, (chunk) => db.insert(emailEvents).values(chunk));
  const dedup = new Map(suppressed.map((x) => [x.email, x]));
  await db.insert(suppressedEmails).values([...dedup.values()]);

  // ── 7. Signup forms ────────────────────────────────────────────────────────
  const key = (label: string) => crypto.createHash("sha256").update(`${DEMO_EMAIL}:${label}`).digest("base64url").slice(0, 12);
  await db.insert(signupForms).values([
    {
      organizationId: orgId, userId, publicKey: key("footer"), name: "Website footer", formType: "static", layout: "card",
      headline: "Stay in the loop", description: "Exhibition openings, workshop dates and news from the studios. One email a month.",
      buttonLabel: "Subscribe", successMessage: "Thanks, you're on the list.", accentColor: TEAL, collectName: true,
      theme: "light", cornerStyle: "rounded", subscriberCount: 612, createdAt: new Date(now - 100 * DAY), updatedAt: new Date(now - 30 * DAY),
    },
    {
      organizationId: orgId, userId, publicKey: key("gallery"), name: "Gallery visit pop-up", formType: "popup", layout: "minimal",
      headline: "Visiting the gallery?", description: "Get the Members' Monthly and first word on new shows.",
      buttonLabel: "Sign me up", successMessage: "Welcome aboard. See you at the next opening.", accentColor: "#B4442E", collectName: false,
      theme: "light", cornerStyle: "pill", subscriberCount: 248, createdAt: new Date(now - 80 * DAY), updatedAt: new Date(now - 45 * DAY),
    },
    {
      organizationId: orgId, userId, publicKey: key("events"), name: "Events page slide-in", formType: "animated", layout: "card",
      headline: "Never miss an opening", description: "A short note before every exhibition and workshop release.",
      buttonLabel: "Notify me", successMessage: "You're in. Watch your inbox.", accentColor: "#3B3F8C", collectName: false,
      theme: "dark", cornerStyle: "sharp", subscriberCount: 97, createdAt: new Date(now - 45 * DAY), updatedAt: new Date(now - 12 * DAY),
    },
    {
      organizationId: orgId, userId, publicKey: key("volunteer"), name: "Volunteer sign-up", formType: "static", layout: "inline",
      headline: "Volunteer with us", description: "Hang shows, steward openings, run the workshop desk. Tell us where to reach you.",
      buttonLabel: "Get involved", successMessage: "Thank you. We'll be in touch soon.", accentColor: "#1F5F5B", collectName: true,
      theme: "light", cornerStyle: "rounded", subscriberCount: 143, createdAt: new Date(now - 35 * DAY), updatedAt: new Date(now - 20 * DAY),
    },
    {
      organizationId: orgId, userId, publicKey: key("waitlist"), name: "Workshop waitlist", formType: "popup", layout: "card",
      headline: "Join the waitlist", description: "Be first to hear when a full workshop opens up a place.",
      buttonLabel: "Join waitlist", successMessage: "You're on the waitlist.", accentColor: "#7C3AED", collectName: true,
      theme: "light", cornerStyle: "rounded", subscriberCount: 76, createdAt: new Date(now - 28 * DAY), updatedAt: new Date(now - 9 * DAY),
    },
    {
      organizationId: orgId, userId, publicKey: key("press"), name: "Press list", formType: "static", layout: "minimal",
      headline: "Press & media", description: "Exhibition announcements and image packs, sent to the press list only.",
      buttonLabel: "Request access", successMessage: "Thanks, we'll add you to the press list.", accentColor: "#0F172A", collectName: true,
      theme: "dark", cornerStyle: "sharp", subscriberCount: 31, createdAt: new Date(now - 18 * DAY), updatedAt: new Date(now - 6 * DAY),
    },
  ]);

  // ── 8. One enabled automation: welcome new subscribers ─────────────────────
  await db.insert(automations).values({
    organizationId: orgId,
    userId,
    name: "Welcome new subscribers",
    status: "enabled",
    flow: {
      version: 1,
      rootId: "t1",
      nodes: {
        t1: { id: "t1", type: "trigger", config: { event: "contact.added" }, next: "d1" },
        d1: { id: "d1", type: "delay", config: { amount: 10, unit: "minutes" }, next: "e1" },
        e1: { id: "e1", type: "send_email", config: { templateId: welcomeTemplateId, fromName: ORG_NAME, fromEmail: FROM_EMAIL }, next: null },
      },
    },
    createdAt: new Date(now - 60 * DAY),
    updatedAt: new Date(now - 30 * DAY),
  });

  // ── Summary ────────────────────────────────────────────────────────────────
  const count = (t: string) => events.filter((e) => e.type === t).length;
  console.log("\nDemo workspace ready.");
  console.log(`  org:        ${ORG_NAME} (${orgId})`);
  console.log(`  contacts:   ${contacts.length}  suppressed: ${dedup.size}`);
  console.log(`  events:     Delivery ${count("Delivery")}, Open ${count("Open")}, Click ${count("Click")}, Bounce ${count("Bounce")}, Complaint ${count("Complaint")}`);
  sentPlans.forEach((p, i) => console.log(`  ${p.sentAt.toISOString().slice(0, 10)}  ${p.name}  (${targetsByCampaign[i].length} recipients)  id=${sentCampaignIds[i]}`));
  console.log(`  scheduled:  ${scheduledId}\n  draft:      ${draftId}`);
  console.log(`  template:   ${tplRows[0].id} (Members' Monthly)`);
  console.log(`\nLogin: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  void and;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

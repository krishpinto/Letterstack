import type { SocialLink } from "./document";

/**
 * The social platforms a social block can link to.
 *
 * One list, read by four places that must not disagree: the compiler (email
 * HTML), the canvas preview, the inspector's picker, and
 * scripts/generate-social-icons.ts, which rasterises `art` into
 * public/social/<id>.png.
 *
 * Adding a platform is: add an entry here, re-run the generator, commit the
 * PNG. Nothing else needs touching.
 *
 * The five original ids (facebook, twitter, instagram, linkedin, youtube) are
 * kept verbatim — documents and templates saved before this list existed
 * carry them, and a rename would silently blank those blocks.
 */
export type SocialPlatform =
  | "instagram"
  | "facebook"
  | "twitter"
  | "linkedin"
  | "youtube"
  | "whatsapp"
  | "telegram"
  | "tiktok"
  | "threads"
  | "pinterest"
  | "discord"
  | "github"
  | "spotify"
  | "reddit"
  | "snapchat"
  | "gmail"
  | "email"
  | "website"
  | "phone"
  | "custom";

export type SocialPlatformSpec = {
  id: SocialPlatform;
  label: string;
  /** Tile colour, baked into the PNG. Brand colours come from simple-icons. */
  brand: string;
  /** Glyph colour. White everywhere except tiles too light to carry it. */
  glyph: string;
  /**
   * Where the artwork comes from. Read ONLY by the generator script — the app
   * ships the rasterised PNGs, never the vectors, so no icon library ends up
   * in the client bundle.
   *
   * `simpleIcon` names an export of the `simple-icons` package (CC0 brand
   * marks). `path` is a 24×24 glyph for the non-brand entries, from Material
   * Symbols (Apache-2.0).
   */
  art: { simpleIcon: string } | { path: string };
  /** Shown in the URL field, so the expected format is obvious. */
  placeholder: string;
};

export const SOCIAL_PLATFORMS: SocialPlatformSpec[] = [
  { id: "instagram", label: "Instagram", brand: "#E4405F", glyph: "#FFFFFF", art: { simpleIcon: "siInstagram" }, placeholder: "https://instagram.com/yourhandle" },
  { id: "facebook", label: "Facebook", brand: "#0866FF", glyph: "#FFFFFF", art: { simpleIcon: "siFacebook" }, placeholder: "https://facebook.com/yourpage" },
  { id: "twitter", label: "X (Twitter)", brand: "#000000", glyph: "#FFFFFF", art: { simpleIcon: "siX" }, placeholder: "https://x.com/yourhandle" },
  // simple-icons dropped LinkedIn after a trademark request, so this is the
  // same mark the marketing footer already uses, minus its container square —
  // the tile below is the container here.
  { id: "linkedin", label: "LinkedIn", brand: "#0A66C2", glyph: "#FFFFFF", placeholder: "https://linkedin.com/company/you",
    art: { path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z" } },
  { id: "youtube", label: "YouTube", brand: "#FF0000", glyph: "#FFFFFF", art: { simpleIcon: "siYoutube" }, placeholder: "https://youtube.com/@yourchannel" },
  { id: "whatsapp", label: "WhatsApp", brand: "#25D366", glyph: "#FFFFFF", art: { simpleIcon: "siWhatsapp" }, placeholder: "https://wa.me/919000000000" },
  { id: "telegram", label: "Telegram", brand: "#26A5E4", glyph: "#FFFFFF", art: { simpleIcon: "siTelegram" }, placeholder: "https://t.me/yourchannel" },
  { id: "tiktok", label: "TikTok", brand: "#000000", glyph: "#FFFFFF", art: { simpleIcon: "siTiktok" }, placeholder: "https://tiktok.com/@yourhandle" },
  { id: "threads", label: "Threads", brand: "#000000", glyph: "#FFFFFF", art: { simpleIcon: "siThreads" }, placeholder: "https://threads.net/@yourhandle" },
  { id: "pinterest", label: "Pinterest", brand: "#BD081C", glyph: "#FFFFFF", art: { simpleIcon: "siPinterest" }, placeholder: "https://pinterest.com/yourhandle" },
  { id: "discord", label: "Discord", brand: "#5865F2", glyph: "#FFFFFF", art: { simpleIcon: "siDiscord" }, placeholder: "https://discord.gg/yourinvite" },
  { id: "github", label: "GitHub", brand: "#181717", glyph: "#FFFFFF", art: { simpleIcon: "siGithub" }, placeholder: "https://github.com/yourorg" },
  { id: "spotify", label: "Spotify", brand: "#1DB954", glyph: "#FFFFFF", art: { simpleIcon: "siSpotify" }, placeholder: "https://open.spotify.com/..." },
  { id: "reddit", label: "Reddit", brand: "#FF4500", glyph: "#FFFFFF", art: { simpleIcon: "siReddit" }, placeholder: "https://reddit.com/r/yoursub" },
  // Snapchat's brand yellow is the one tile a white glyph disappears on.
  { id: "snapchat", label: "Snapchat", brand: "#FFFC00", glyph: "#111111", art: { simpleIcon: "siSnapchat" }, placeholder: "https://snapchat.com/add/yourhandle" },
  { id: "gmail", label: "Gmail", brand: "#EA4335", glyph: "#FFFFFF", art: { simpleIcon: "siGmail" }, placeholder: "mailto:hello@yourcompany.com" },

  // Non-brand utilities. Deliberately one neutral slate rather than invented
  // brand colours, so they read as "contact us" next to the real logos.
  { id: "email", label: "Email", brand: "#52525B", glyph: "#FFFFFF", placeholder: "mailto:hello@yourcompany.com",
    art: { path: "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" } },
  { id: "website", label: "Website", brand: "#52525B", glyph: "#FFFFFF", placeholder: "https://yourcompany.com",
    art: { path: "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56 1.84.63 3.37 1.91 4.33 3.56zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2s.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56-1.84-.63-3.37-1.9-4.33-3.56zm2.95-8H5.08c.96-1.66 2.49-2.93 4.33-3.56C8.81 5.55 8.35 6.75 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2s.07-1.35.16-2h4.68c.09.65.16 1.32.16 2s-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95c-.96 1.65-2.49 2.93-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2s-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z" } },
  { id: "phone", label: "Phone", brand: "#52525B", glyph: "#FFFFFF", placeholder: "tel:+919000000000",
    art: { path: "M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" } },

  // Its PNG is the fallback for a custom link with no image of its own yet,
  // so the block never renders a broken-image box while someone is mid-edit.
  { id: "custom", label: "Custom…", brand: "#52525B", glyph: "#FFFFFF", placeholder: "https://",
    art: { path: "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" } },
];

const BY_ID = new Map(SOCIAL_PLATFORMS.map((p) => [p.id, p]));

/** Never throws: an unknown id (an older document, a hand-edited JSON) falls
 *  back to the custom tile rather than blanking the icon. */
export function socialPlatform(id: string): SocialPlatformSpec {
  return BY_ID.get(id as SocialPlatform) ?? BY_ID.get("custom")!;
}

/**
 * Where the icon image lives.
 *
 * `base` is empty in the editor (same origin) and absolute in compiled email
 * — a recipient's client has no origin to resolve a relative path against.
 * A custom link's own image is already absolute, so it ignores the base.
 */
export function socialIconSrc(link: SocialLink, base = ""): string {
  if (link.platform === "custom" && link.iconSrc) return link.iconSrc;
  return `${base}/social/${socialPlatform(link.platform).id}.png`;
}

/** Alt text and hover title: the custom label if there is one, else the
 *  platform's own name. */
export function socialLabel(link: SocialLink): string {
  if (link.platform === "custom") return link.label?.trim() || "Link";
  return socialPlatform(link.platform).label;
}

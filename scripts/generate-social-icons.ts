/**
 * Rasterises every entry in SOCIAL_PLATFORMS to public/social/<id>.png.
 *
 * Email needs raster: Gmail and Outlook both drop inline SVG, and an icon
 * font is worse. So the vectors live here at build time and the app ships
 * only PNGs — which also keeps simple-icons out of the client bundle.
 *
 * 64px for a 32px display box, so the tiles stay sharp on retina. Circles
 * with transparent corners rather than squares, so they sit on any
 * background colour the email settings pick.
 *
 * Run after editing SOCIAL_PLATFORMS, then commit the PNGs:
 *   npx tsx scripts/generate-social-icons.ts
 */
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import * as simpleIcons from "simple-icons";

import { SOCIAL_PLATFORMS } from "../lib/email/social";

/** Rendered size. Displayed at half this, so it stays crisp on retina. */
const SIZE = 64;
/** The glyph's box inside the tile — the rest is padding. */
const GLYPH = 30;

const OUT_DIR = path.join(process.cwd(), "public", "social");

function glyphPath(art: { simpleIcon: string } | { path: string }): string {
  if ("path" in art) return art.path;
  const icon = (simpleIcons as unknown as Record<string, { path: string }>)[art.simpleIcon];
  if (!icon) throw new Error(`simple-icons has no export "${art.simpleIcon}"`);
  return icon.path;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const platform of SOCIAL_PLATFORMS) {
    // simple-icons and Material both draw on a 24×24 grid, so one transform
    // centres either kind.
    const scale = GLYPH / 24;
    const offset = (SIZE - GLYPH) / 2;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${SIZE / 2}" fill="${platform.brand}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <path d="${glyphPath(platform.art)}" fill="${platform.glyph}"/>
  </g>
</svg>`;

    const file = path.join(OUT_DIR, `${platform.id}.png`);
    await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(file);
    console.log(`${platform.id.padEnd(10)} ${platform.brand}  ${fs.statSync(file).size} bytes`);
  }

  console.log(`\n${SOCIAL_PLATFORMS.length} icons written to public/social/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

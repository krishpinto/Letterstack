// Captures the product screenshots used on the landing page, from the demo
// workspace seeded by scripts/seed-demo-workspace.ts.
//
//   1. npx tsx scripts/seed-demo-workspace.ts        (fresh data, fresh dates)
//   2. a dev server running (default http://localhost:3000)
//   3. DEMO_PASSWORD=... node scripts/capture-landing-screenshots.mjs [screen ...]
//      (THEME=dark for the app's dark look; light by default, to match the site)
//
// Output: public/product/app-<screen>.webp, 2880x1800 (1440x900 CSS px @2x).
//
// Needs `playwright-core` (not a repo dependency) and a Chromium. Install the
// package outside the repo and point PLAYWRIGHT_CORE_DIR at it, e.g.
//   npm i --prefix ~/ls-capture playwright-core
//   PLAYWRIGHT_CORE_DIR=~/ls-capture node scripts/capture-landing-screenshots.mjs
// Chromium: PLAYWRIGHT_CHROMIUM_PATH, or the one Playwright already installed
// under %LOCALAPPDATA%/ms-playwright.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(process.env.PLAYWRIGHT_CORE_DIR ?? root, "noop.js"));
const { chromium } = require("playwright-core");
const sharp = require(path.join(root, "node_modules", "sharp"));

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = "demo@example.com";
// The password the seed script printed (or the DEMO_PASSWORD you gave it).
const PASSWORD = process.env.DEMO_PASSWORD;
if (!PASSWORD) {
  console.error("Set DEMO_PASSWORD to the password printed by scripts/seed-demo-workspace.ts");
  process.exit(1);
}
const OUT = path.join(root, "public", "product");
const RAW = process.env.RAW_DIR ?? path.join(os.tmpdir(), "letterstack-landing-raw");
const TEMPLATE_NAME = "Members' Monthly";
const REPORT_CAMPAIGN = "Annual Appeal: Support Studio Access";
const MAX_BYTES = 400 * 1024;
const THEME = process.env.THEME === "dark" ? "dark" : "light";

// Transient UI that must never appear in a marketing shot.
const HIDE_CSS = `
  nextjs-portal, [data-nextjs-toast], [data-nextjs-dev-tools-button], [data-next-badge-root],
  [data-sonner-toaster], [data-sonner-toast], .Toastify, #__next-build-watcher,
  [data-onborda-overlay], #onborda-portal, .onborda-overlay { display: none !important; }
  * { caret-color: transparent !important; }
`;

async function findChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const base = path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"), "ms-playwright");
  if (!fs.existsSync(base)) return undefined; // let Playwright look in its default place
  const dirs = fs.readdirSync(base).filter((d) => d.startsWith("chromium-")).sort().reverse();
  for (const d of dirs) {
    const exe = path.join(base, d, "chrome-win64", "chrome.exe");
    if (fs.existsSync(exe)) return exe;
  }
  return undefined;
}

async function main() {
  const wanted = process.argv.slice(2);
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(RAW, { recursive: true });

  const browser = await chromium.launch({ executablePath: await findChromium(), headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "light",
  });
  const page = await context.newPage();
  // App theme for the shots: "light" (the marketing site's look, default) or
  // "dark". next-themes reads it from localStorage before first paint.
  await page.addInitScript((theme) => {
    try {
      localStorage.setItem("theme", theme);
    } catch {}
  }, THEME);
  await page.addInitScript((css) => {
    const add = () => {
      const s = document.createElement("style");
      s.textContent = css;
      (document.head ?? document.documentElement).appendChild(s);
    };
    if (document.head) add();
    else document.addEventListener("DOMContentLoaded", add);
  }, HIDE_CSS);

  // ── Log in with the real credentials form ──
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"], input[name="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 }),
    page.locator('input[type="password"]').first().press("Enter"),
  ]);

  // ── Look up ids, and mark the product tour as already seen ──
  const api = async (p) => page.evaluate(async (u) => (await fetch(u)).json(), p);
  const dash = await api("/api/dashboard");
  await page.evaluate((id) => {
    try { localStorage.setItem(`letterstack:dashboard-tour-seen:${id}`, "1"); } catch {}
  }, dash.organizationId);
  const { campaigns = [] } = await api("/api/campaigns");
  const { templates = [] } = await api("/api/templates");
  const report = campaigns.find((c) => c.name === REPORT_CAMPAIGN);
  const template = templates.find((t) => t.name === TEMPLATE_NAME);
  if (!report || !template) throw new Error("Demo data not found. Run scripts/seed-demo-workspace.ts first.");

  const screens = [
    // The dashboard area chart's Y axis is 40px wide, so ticks of 3+ digits ("600", "1200") render clipped as "00". Hide the tick labels for the shot.
    { key: "dashboard", url: "/dashboard", ready: "text=Welcome back", settle: 2500, css: ".recharts-yAxis-tick-labels text { display: none !important; }" },
    { key: "editor", url: `/editor/template/${template.id}`, ready: "text=What's on at Northfield", settle: 4000 },
    { key: "campaigns", url: "/dashboard/campaigns", ready: "text=November Newsletter", settle: 1500 },
    { key: "report", url: `/dashboard/campaigns/analytics/${report.id}`, ready: "text=Support Studio Access", settle: 3500 },
    { key: "audience", url: "/dashboard/audience", ready: "text=Workshop alumni", settle: 2000 },
    { key: "forms", url: "/dashboard/forms", ready: "text=Website footer", settle: 2500 },
    { key: "analytics", url: "/dashboard/analytics", ready: "text=Gala", settle: 3000 },
  ];

  for (const s of screens) {
    if (wanted.length && !wanted.includes(s.key)) continue;
    process.stdout.write(`${s.key}: `);
    await page.goto(`${BASE}${s.url}`, { waitUntil: "domcontentloaded" });
    if (s.css) await page.addStyleTag({ content: s.css });
    await page.waitForSelector(s.ready, { timeout: 60_000 }).catch(() => console.log("(ready selector not found)"));
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForTimeout(s.settle);
    await page.mouse.move(1430, 890); // park the pointer away from hover states
    if (s.css) await page.addStyleTag({ content: s.css });
    const png = path.join(RAW, `app-${s.key}.png`);
    await page.screenshot({ path: png });

    // WebP, quality ~85, stepping down until under the size budget.
    const dest = path.join(OUT, `app-${s.key}.webp`);
    let q = 85;
    let info;
    for (;;) {
      info = await sharp(png).webp({ quality: q, effort: 6 }).toFile(dest);
      if (info.size <= MAX_BYTES || q <= 60) break;
      q -= 5;
    }
    console.log(`${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)} KB  (q${q})`);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

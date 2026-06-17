import { Client } from "@upstash/qstash";

/**
 * Our handle to QStash — the "phone" we use to hand it jobs.
 *
 * In development, QSTASH_URL points at the local dev server
 * (`npx @upstash/qstash-cli dev`). In production, QSTASH_URL is unset and the
 * client talks to real cloud QStash automatically. Same code either way — only
 * the env values change.
 */
export const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
  baseUrl: process.env.QSTASH_URL, // undefined in prod → real cloud QStash
});

/**
 * The public base URL QStash should call back into.
 * - Local dev: http://localhost:3000
 * - Vercel: the deployment's production URL (auto-detected)
 * - Override anytime with APP_URL (e.g. a custom domain).
 */
export function appBaseUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}

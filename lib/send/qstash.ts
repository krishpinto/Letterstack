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

import net from "node:net";
import { Client } from "@upstash/qstash";

/**
 * QStash client, created lazily so Next can build without eagerly touching
 * runtime-only environment variables.
 */
let client: Client | null = null;
let lastLocalCheck: { url: string; ok: boolean; checkedAt: number } | null = null;

type PublishJsonArgs = Parameters<Client["publishJSON"]>[0];

export function getQstash() {
  const token = process.env.QSTASH_TOKEN;
  if (!token) {
    throw new Error("QSTASH_TOKEN missing. Set it in .env.local before sending campaigns.");
  }

  client ??= new Client({
    token,
    baseUrl: process.env.QSTASH_URL,
  });

  return client;
}

export async function ensureQstashReady() {
  getQstash();

  const baseUrl = process.env.QSTASH_URL;
  if (baseUrl) {
    await ensureLocalQstashReady(baseUrl);
  }
}

export async function publishQstashJSON(args: PublishJsonArgs) {
  await ensureQstashReady();

  try {
    return await getQstash().publishJSON(args);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown QStash error";
    throw new Error(`QStash publish failed. ${detail}`);
  }
}

/**
 * QStash rejects delayed messages beyond its plan quota (7 days on the free
 * plan: "quota maxDelay exceeded, current limit: 604800"). Anything further
 * out must hop: sleep the max delay, then re-enqueue on arrival. An hour of
 * headroom keeps us clear of the exact limit.
 */
export const QSTASH_MAX_DELAY_MS = 604_800_000 - 3_600_000;

/** notBefore (unix seconds) for a target time, capped to one allowed hop. */
export function qstashNotBefore(targetMs: number): number {
  const capped = Math.min(targetMs, Date.now() + QSTASH_MAX_DELAY_MS);
  return Math.floor(capped / 1000);
}

export function appBaseUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}

async function ensureLocalQstashReady(baseUrl: string) {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error(`QSTASH_URL is invalid: ${baseUrl}`);
  }

  if (!isLocalHost(url.hostname)) return;

  const now = Date.now();
  if (lastLocalCheck?.url === baseUrl && lastLocalCheck.ok && now - lastLocalCheck.checkedAt < 5_000) {
    return;
  }

  const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
  const ok = await canOpenSocket(url.hostname, port);
  lastLocalCheck = { url: baseUrl, ok, checkedAt: now };

  if (!ok) {
    throw new Error(
      `QStash local dev server is not reachable at ${baseUrl}. Start it with ` +
        "`npm run qstash:dev`, then retry the send.",
    );
  }
}

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function canOpenSocket(host: string, port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(750);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

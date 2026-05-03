// MX record lookup with in-memory cache
// Used by validator.ts before every SMTP connection
// Caches results so we don't look up the same domain repeatedly

import dns from "dns/promises";

interface MXRecord {
  exchange: string; // the mail server hostname e.g. "mail.company.com"
  priority: number; // lower = higher priority, we pick the lowest
}

interface CacheEntry {
  records: MXRecord[];
  expiresAt: number; // unix timestamp — we respect the TTL
}

// In-memory cache — lives as long as the process runs
// In production this would be Redis, for MVP this is fine
const cache = new Map<string, CacheEntry>();

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes if we can't get real TTL

export async function getMXRecords(domain: string): Promise<MXRecord[]> {
  const now = Date.now();
  const cached = cache.get(domain);

  // Return cached result if still valid
  if (cached && cached.expiresAt > now) {
    return cached.records;
  }

  try {
    // dns.resolveMx returns array of { exchange, priority }
    const records = await dns.resolveMx(domain);

    // Sort by priority — lowest number = highest priority mail server
    const sorted = records.sort((a, b) => a.priority - b.priority);

    // Store in cache
    cache.set(domain, {
      records: sorted,
      expiresAt: now + DEFAULT_TTL_MS,
    });

    return sorted;
  } catch {
    // Domain has no MX records — emails here will never work
    cache.set(domain, { records: [], expiresAt: now + DEFAULT_TTL_MS });
    return [];
  }
}

export function getTopMX(records: MXRecord[]): string | null {
  // Returns the highest priority mail server hostname
  // validator.ts uses this to know which server to connect to
  return records.length > 0 ? records[0].exchange : null;
}
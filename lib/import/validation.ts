import { promises as dns } from "node:dns";

import { DISPOSABLE_DOMAINS, ROLE_PREFIXES, TYPO_DOMAINS } from "./lists";

// Free import-time email filter (Stage 1). Cheap synchronous checks + one DNS
// step (MX with A/AAAA fallback), deduped per-domain so a 3,000-row list with
// 400 unique domains does 400 lookups, not 3,000.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254; // RFC 5321
const DNS_TIMEOUT_MS = 4_000;
const DNS_CONCURRENCY = 20;

// "invalid_syntax" | "dead_domain" | "disposable" are drops; "valid" imports.
export type EmailStatus = "valid" | "invalid_syntax" | "dead_domain" | "disposable";
// Advisory only — a flagged address is still imported, just surfaced for review.
export type EmailFlag = "role" | "typo";

export type ValidatedEmail = {
  input: string;
  email: string;
  status: EmailStatus;
  flags: EmailFlag[];
  suggestion?: string;
};

export type ValidationReport = {
  total: number;
  valid: number;
  invalidSyntax: number;
  deadDomain: number;
  disposable: number;
  role: number;
  typos: number;
};

export function normalizeEmail(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

export function isSyntaxValid(email: string): boolean {
  return email.length <= MAX_EMAIL_LENGTH && EMAIL_RE.test(email);
}

function domainOf(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1);
}

function localOf(email: string): string {
  return email.slice(0, email.indexOf("@"));
}

export function isRoleAddress(email: string): boolean {
  return ROLE_PREFIXES.has(localOf(email));
}

export function isDisposableDomain(domain: string): boolean {
  return DISPOSABLE_DOMAINS.has(domain);
}

export function suggestTypoFix(domain: string): string | undefined {
  return TYPO_DOMAINS[domain];
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("dns_timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function isConclusiveMissCode(code: string | undefined): boolean {
  // Codes that mean "this record genuinely does not exist" (as opposed to a
  // transient failure on our side, which we must not treat as a dead domain).
  return code === "ENOTFOUND" || code === "ENODATA";
}

// true = has a mail route, false = provably cannot receive mail, null = we
// could not determine it (timeout / SERVFAIL) — caller keeps null addresses.
async function resolveDomainAlive(domain: string): Promise<boolean | null> {
  try {
    const mx = await withTimeout(dns.resolveMx(domain), DNS_TIMEOUT_MS);
    if (mx.some((record) => record.exchange && record.exchange !== ".")) {
      return true;
    }
    // Empty MX set — fall through to the A/AAAA implicit-MX check below.
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOTFOUND") return false; // NXDOMAIN — domain does not exist
    if (code !== "ENODATA") return null; // timeout / SERVFAIL — inconclusive
    // ENODATA — domain exists but has no MX; try A/AAAA fallback.
  }

  // RFC 5321: with no MX, mail may be delivered to the domain's A/AAAA host.
  try {
    const a = await withTimeout(dns.resolve4(domain), DNS_TIMEOUT_MS);
    if (a.length > 0) return true;
  } catch (error) {
    if (!isConclusiveMissCode((error as NodeJS.ErrnoException).code)) return null;
  }
  try {
    const aaaa = await withTimeout(dns.resolve6(domain), DNS_TIMEOUT_MS);
    if (aaaa.length > 0) return true;
  } catch (error) {
    if (!isConclusiveMissCode((error as NodeJS.ErrnoException).code)) return null;
  }

  return false; // no MX, no A, no AAAA — cannot receive mail
}

async function resolveDomainsAlive(
  domains: string[],
): Promise<Map<string, boolean | null>> {
  const out = new Map<string, boolean | null>();
  let cursor = 0;
  async function worker() {
    while (cursor < domains.length) {
      const domain = domains[cursor++];
      out.set(domain, await resolveDomainAlive(domain));
    }
  }
  const workers = Array.from(
    { length: Math.min(DNS_CONCURRENCY, domains.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return out;
}

/**
 * Validate a batch of raw email strings. Results come back in input order so
 * callers can zip them against the original rows (for names, etc.).
 */
export async function validateEmails(rawEmails: string[]): Promise<{
  results: ValidatedEmail[];
  report: ValidationReport;
}> {
  // Pass 1 — cheap synchronous checks.
  const prelim: ValidatedEmail[] = rawEmails.map((input) => {
    const email = normalizeEmail(input);
    if (!isSyntaxValid(email)) {
      return { input, email, status: "invalid_syntax", flags: [] };
    }
    const domain = domainOf(email);
    const flags: EmailFlag[] = [];
    const suggestion = suggestTypoFix(domain);
    if (suggestion) flags.push("typo");
    if (isRoleAddress(email)) flags.push("role");
    if (isDisposableDomain(domain)) {
      return { input, email, status: "disposable", flags, suggestion };
    }
    return { input, email, status: "valid", flags, suggestion };
  });

  // Pass 2 — MX/DNS only for still-valid addresses, deduped by domain.
  const domains = new Set<string>();
  for (const item of prelim) {
    if (item.status === "valid") domains.add(domainOf(item.email));
  }
  const alive = await resolveDomainsAlive([...domains]);

  // Pass 3 — finalize + tally.
  const report: ValidationReport = {
    total: rawEmails.length,
    valid: 0,
    invalidSyntax: 0,
    deadDomain: 0,
    disposable: 0,
    role: 0,
    typos: 0,
  };

  const results = prelim.map((item) => {
    if (item.status === "valid" && alive.get(domainOf(item.email)) === false) {
      item = { ...item, status: "dead_domain" };
    }

    switch (item.status) {
      case "invalid_syntax":
        report.invalidSyntax++;
        break;
      case "dead_domain":
        report.deadDomain++;
        break;
      case "disposable":
        report.disposable++;
        break;
      case "valid":
        report.valid++;
        if (item.flags.includes("role")) report.role++;
        if (item.flags.includes("typo")) report.typos++;
        break;
    }
    return item;
  });

  return { results, report };
}

// Refuses the drizzle-kit commands that write to a database unless they are
// pointed, on purpose, at something other than production.
//
// `drizzle-kit push` diffs db/schema.ts against a database and applies the
// difference, drops included. Against production that has offered to drop
// indexes and TRUNCATE tables before. `drizzle-kit migrate` applies
// drizzle's own migration history, which is not how this database is
// migrated (docs/database.md). Removing the npm script would not be enough,
// since `npx drizzle-kit push` still works; drizzle.config.ts runs for
// every drizzle-kit command that uses it, so the check lives there and
// calls this.
//
// push is still useful for one thing: creating the schema on a new, empty
// Neon branch for local development. So it is allowed when both are true:
//   - ALLOW_DB_PUSH=1 is set (nobody runs it by accident), and
//   - DATABASE_URL's host is not PRODUCTION_DATABASE_HOST.
// Fail-closed: without PRODUCTION_DATABASE_HOST nothing proves the target
// is not production, so the answer is no.
//
// Not covered: drizzle-kit invoked with connection flags (--url, --dialect)
// and no config file never loads this. Don't do that.

/** drizzle-kit commands that change a database. */
export const DATABASE_WRITING_COMMANDS = new Set(["push", "migrate"]);

/**
 * The database-writing drizzle-kit command in argv, if any. Every argument
 * is checked rather than "the first non-flag one", because flag values
 * (`--config drizzle.config.ts push`) are non-flags too.
 */
export function databaseWritingCommand(argv: readonly string[]): string | null {
  return argv.slice(2).find((arg) => DATABASE_WRITING_COMMANDS.has(arg)) ?? null;
}

/**
 * Neon serves the same endpoint on two hosts: ep-x-123.region.aws.neon.tech
 * and the pooled ep-x-123-pooler.region.aws.neon.tech. Compare endpoints,
 * not spellings, so the pooled URL of production is still production.
 */
export function normalizeDatabaseHost(host: string): string {
  const [first, ...rest] = host.trim().toLowerCase().split(".");
  return [first.replace(/-pooler$/, ""), ...rest].join(".");
}

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const { hostname } = new URL(url);
    return hostname ? normalizeDatabaseHost(hostname) : null;
  } catch {
    return null;
  }
}

/**
 * PRODUCTION_DATABASE_HOST may be given as a bare host or, by mistake, as a
 * full connection string. Either way only the host is compared.
 */
function productionHostOf(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  return value.includes("://") ? hostOf(value) : normalizeDatabaseHost(value);
}

/** Null when the command may run; otherwise the reason it may not. */
export function drizzleKitRefusal(
  argv: readonly string[],
  env: Record<string, string | undefined>,
): string | null {
  const command = databaseWritingCommand(argv);
  if (!command) return null;

  const advice =
    "Schema changes to production are hand-written SQL in db/migrations/pending/, tested on a Neon branch first. See docs/database.md.";

  if (command === "migrate") {
    return `drizzle-kit migrate is disabled: this database is not migrated from drizzle's history. ${advice}`;
  }

  if (env.ALLOW_DB_PUSH !== "1") {
    return `drizzle-kit push is disabled. ${advice} To create the schema on a new, empty Neon branch, set ALLOW_DB_PUSH=1 and PRODUCTION_DATABASE_HOST.`;
  }

  const productionHost = productionHostOf(env.PRODUCTION_DATABASE_HOST);
  if (!productionHost) {
    return `drizzle-kit push needs PRODUCTION_DATABASE_HOST (the production database host) so it can refuse to touch it. ${advice}`;
  }

  const targetHost = hostOf(env.DATABASE_URL);
  if (!targetHost) {
    return "drizzle-kit push: DATABASE_URL is missing or not a URL.";
  }
  if (targetHost === productionHost) {
    return `drizzle-kit push refused: DATABASE_URL points at production (${targetHost}). ${advice}`;
  }

  return null;
}

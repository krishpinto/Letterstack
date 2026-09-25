/**
 * Cursor pagination for list endpoints.
 *
 * Cursors, not OFFSET. An audience changes while someone pages through it,
 * and OFFSET is positional: insert a contact while a client is on page 2 and
 * every later page silently shifts, so rows get skipped or repeated. A
 * cursor names the last row seen, so the next page is "everything after
 * this", which stays correct however much the table moves underneath.
 *
 * The sort key is (created_at, id) descending. created_at alone is not
 * unique — a bulk import writes hundreds of rows in the same millisecond —
 * and a non-unique cursor loses or duplicates rows at the page boundary. The
 * id breaks the tie.
 *
 * The encoding is base64url of "<timestamp>|<uuid>", opaque by convention:
 * it is documented as a token to echo back, never to construct. That keeps
 * the sort key an implementation detail we can change later.
 *
 * The timestamp half is Postgres's own text rendering of the column
 * (`created_at::text`), carried around as a string and cast straight back
 * with `::timestamptz`. It is NOT a JS Date, and that is the whole point:
 * a Date holds milliseconds while the column holds microseconds, so
 * round-tripping through one truncates .230456 to .230. A bulk import writes
 * hundreds of rows inside a single millisecond, so a page boundary landing
 * in one of those clusters would silently skip every row in the truncated
 * remainder. Keeping the database's own value means the comparison is exact.
 */

export type Cursor = { ts: string; id: string };

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

/** `ts` must be the value of `created_at::text`, never a Date. */
export function encodeCursor(ts: string, id: string): string {
  return Buffer.from(`${ts}|${id}`, "utf8").toString("base64url");
}

/** Null for anything unparseable — a bad cursor starts from the beginning
 *  rather than erroring, since it is usually a truncated URL. */
export function decodeCursor(value: string | null): Cursor | null {
  if (!value) return null;

  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    // The uuid is fixed-width and the timestamp can contain anything, so
    // split on the LAST separator rather than the first.
    const separator = decoded.lastIndexOf("|");
    if (separator <= 0) return null;

    const ts = decoded.slice(0, separator);
    const id = decoded.slice(separator + 1);
    if (!ts || !UUID_RE.test(id)) return null;

    return { ts, id };
  } catch {
    return null;
  }
}

/** Guards the `::uuid` cast in the query — a malformed id would otherwise
 *  reach Postgres and raise instead of reading as a bad cursor. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `limit` from a query string, clamped. Junk falls back to the default. */
export function parsePageSize(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(parsed), MAX_PAGE_SIZE);
}

/**
 * Splits an over-fetched page into the page itself plus the next cursor.
 *
 * Callers ask the database for limit + 1 rows: if the extra row came back
 * there is another page, and that is known without a second COUNT query.
 */
export function buildPage<T extends { cursorTs: string; id: string }>(
  rows: T[],
  limit: number,
): { page: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];

  return {
    page,
    nextCursor: hasMore && last ? encodeCursor(last.cursorTs, last.id) : null,
  };
}

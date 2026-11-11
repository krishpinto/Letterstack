// Client-side batching for contact imports.
//
// A 50,000-row file used to go up as one request, with MX lookups for every
// domain inside it — long enough to hit the serverless timeout, after which
// nobody knew how much had been imported. The wizard now sends the rows in
// chunks, adds the per-chunk summaries together, and can resume from the
// chunk that failed. These helpers are the pure part of that. They import
// nothing, so both the wizard and the import routes can use them.

/** Rows per request. Small enough that one chunk's DNS pass stays bounded. */
export const IMPORT_CHUNK_SIZE = 1_000;

/** Hard cap on one request, enforced by the import routes. */
export const IMPORT_MAX_ROWS_PER_REQUEST = 5_000;

/** Hard cap on one file, enforced by the wizard. */
export const IMPORT_MAX_ROWS_PER_FILE = 50_000;

/**
 * "Contact added" automations fired by one import, across all its chunks.
 * The import used to be one request that fired for its first 1,000 new
 * contacts only, so a big list could not fan out tens of thousands of
 * welcome emails at once. Chunking would have lifted that to 1,000 per
 * chunk; the wizard passes the remaining budget with each chunk instead.
 */
export const IMPORT_AUTOMATION_CAP = 1_000;

export type ImportSummary = {
  received: number;
  imported: number;
  duplicates: number;
  invalid: number;
  suppressed: number;
  deadDomain: number;
  disposable: number;
  roleFlagged: number;
  typos: number;
  /** Contacts placed in the chosen folder (new and already-existing). */
  addedToFolder: number;
};

export function emptyImportSummary(): ImportSummary {
  return {
    received: 0,
    imported: 0,
    duplicates: 0,
    invalid: 0,
    suppressed: 0,
    deadDomain: 0,
    disposable: 0,
    roleFlagged: 0,
    typos: 0,
    addedToFolder: 0,
  };
}

/** Adds a (possibly partial) server summary into a running total. */
export function addImportSummary(
  total: ImportSummary,
  chunk: Partial<Record<keyof ImportSummary, unknown>>,
): ImportSummary {
  const next = { ...total };
  for (const key of Object.keys(next) as (keyof ImportSummary)[]) {
    const value = Number(chunk[key] ?? 0);
    if (Number.isFinite(value)) next[key] += value;
  }
  return next;
}

export function chunkRows<T>(rows: T[], size = IMPORT_CHUNK_SIZE): T[][] {
  if (size <= 0) throw new Error("chunk size must be positive");
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

/** Automations budget to send with the next chunk. Never negative. */
export function remainingAutomationBudget(queuedSoFar: number): number {
  const queued = Number.isFinite(queuedSoFar) ? Math.max(0, queuedSoFar) : 0;
  return Math.max(0, IMPORT_AUTOMATION_CAP - queued);
}

/** 0–100 for the progress bar. */
export function importPercent(doneChunks: number, chunkCount: number): number {
  if (chunkCount <= 0) return 0;
  const clamped = Math.min(Math.max(doneChunks, 0), chunkCount);
  return Math.round((clamped / chunkCount) * 100);
}

/**
 * What to say when an import stops part-way. The important part is the
 * second sentence: the earlier chunks are already saved, and Retry picks up
 * at the chunk that failed rather than starting the file again.
 */
export function describeStoppedImport(
  total: ImportSummary,
  failedChunk: number,
  chunkCount: number,
): string {
  const batch = `Batch ${failedChunk + 1} of ${chunkCount} didn't import.`;
  if (failedChunk === 0) {
    return `${batch} Nothing has been imported yet.`;
  }
  const rows = total.received.toLocaleString("en-US");
  const imported = total.imported.toLocaleString("en-US");
  return (
    `${batch} The ${rows} row${total.received === 1 ? "" : "s"} before it ` +
    `${total.received === 1 ? "is" : "are"} done (${imported} new ` +
    `contact${total.imported === 1 ? "" : "s"}). Retry continues from batch ` +
    `${failedChunk + 1}.`
  );
}

// A bounded retry for database reads that fail on the network.
//
// The Neon HTTP driver sends every query as one POST. Now and then that POST
// fails before an answer comes back (a reset connection, a 502/503/504 from
// Neon's proxy while compute wakes up), and the page or worker that asked
// fails with it, although asking again a moment later would have worked.
//
// Only a read can be asked again safely. When a POST fails with no response,
// nobody knows whether the statement ran; repeating an INSERT or an UPDATE
// could do it twice (a second send-quota reservation, a second invoice
// serial). So this retries a request only when it is provably a plain read:
// one statement (never a batch: batches are transactions and usually write)
// that starts with SELECT and contains nothing that writes or locks. Anything
// it cannot classify is sent once, as before. SQL errors (HTTP 400) are never
// retried: the same query fails the same way.

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Gateway statuses that mean "the query did not get an answer", not "it failed". */
const RETRYABLE_STATUSES = new Set([502, 503, 504]);

/**
 * Words that make a SELECT write, lock, or have a side effect. Matched as
 * whole words, so updated_at or deleted are fine. A false positive only means
 * one fewer retry, so the list errs wide; string literals that happen to
 * contain one of these words are treated the same way.
 */
const NOT_A_PLAIN_READ =
  /\b(insert|update|delete|merge|truncate|copy|call|nextval|setval|set_config|pg_notify|pg_advisory_\w+|lo_\w+|pg_sleep)\b|\bfor\s+(no\s+key\s+)?(update|share|key\s+share)\b/i;

/** True when a request body is a single SELECT that changes nothing. */
export function isPlainReadRequest(body: unknown): boolean {
  if (typeof body !== "string") return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== "object" || !("query" in parsed)) return false;
  const query = (parsed as { query: unknown }).query;
  if (typeof query !== "string") return false;

  const sql = query
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--.*$/gm, " ")
    .trim()
    .replace(/^\(+\s*/, "");
  return /^select\b/i.test(sql) && !NOT_A_PLAIN_READ.test(sql);
}

export type ReadRetryOptions = {
  /** Extra attempts after the first. */
  retries?: number;
  /** Delay before the first retry; doubles each time, plus jitter. */
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** The fetch to wrap, looked up per call by default (Next.js patches it). */
  fetchImpl?: Fetch;
};

/** Wraps fetch so plain reads get `retries` more attempts on network failure. */
export function withReadRetry({
  retries = 2,
  baseDelayMs = 100,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  fetchImpl,
}: ReadRetryOptions = {}): Fetch {
  return async (input, init) => {
    const send = () => (fetchImpl ?? globalThis.fetch)(input, init);
    if (!isPlainReadRequest(init?.body)) return send();

    for (let attempt = 0; ; attempt++) {
      const last = attempt >= retries;
      try {
        const response = await send();
        if (last || !RETRYABLE_STATUSES.has(response.status)) return response;
      } catch (error) {
        if (last) throw error;
      }
      const delay = baseDelayMs * 2 ** attempt;
      await sleep(delay + Math.random() * delay);
    }
  };
}

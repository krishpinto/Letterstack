// Client-side JSON fetching for the dashboard's own API routes.
//
// Every route answers `{ ok: true, ... }` or `{ ok: false, error: "..." }`.
// The pages used to read only `data.ok` and fall back to an empty list or a
// generic "Something went wrong" — so a timeout looked exactly like "you
// have no campaigns", and a 429 or 403 hid the one sentence that told the
// person what to do. fetchJson turns every failure into an ApiError whose
// message is the server's own `error` text whenever there is one.

export const NETWORK_ERROR_MESSAGE =
  "Could not reach the server. Check your connection and try again.";

export class ApiError extends Error {
  /** HTTP status, or 0 when the request never got a response. */
  readonly status: number;
  /** The parsed response body, when there was one. */
  readonly body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function serverErrorText(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const value = (body as { error?: unknown }).error;
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

/**
 * The sentence to show for a failed response. Prefers the route's own
 * `error` field; otherwise says something specific to the status rather
 * than a bare "failed".
 */
export function errorMessageFrom(
  body: unknown,
  status: number,
  fallback = "Something went wrong. Try again.",
): string {
  const fromServer = serverErrorText(body);
  if (fromServer) return fromServer;
  if (status === 0) return NETWORK_ERROR_MESSAGE;
  if (status === 401) return "Your session has expired. Sign in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "Not found. It may have been deleted.";
  if (status === 408 || status === 504) {
    return "The server took too long to answer. Try again.";
  }
  if (status === 428) return "Choose a workspace first.";
  if (status === 429) return "Too many requests. Wait a moment and try again.";
  return fallback;
}

/** The message to show for anything a fetchJson call threw. */
export function errorMessage(error: unknown, fallback?: string): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return NETWORK_ERROR_MESSAGE;
  if (error instanceof Error && error.message) return error.message;
  return fallback ?? "Something went wrong. Try again.";
}

type JsonInit = Omit<RequestInit, "body"> & {
  /** Sent as JSON with the matching Content-Type. */
  json?: unknown;
  body?: BodyInit | null;
};

/**
 * fetch + JSON parse + error normalisation. Resolves with the parsed body
 * only when the response is 2xx AND the body does not say `ok: false`.
 * Rejects with ApiError otherwise (status 0 for network failures).
 */
export async function fetchJson<T = Record<string, unknown>>(
  input: string,
  init: JsonInit = {},
): Promise<T> {
  const { json, headers, ...rest } = init;
  const requestInit: RequestInit = { ...rest };
  if (json !== undefined) {
    requestInit.body = JSON.stringify(json);
    requestInit.headers = { "Content-Type": "application/json", ...(headers ?? {}) };
  } else if (headers) {
    requestInit.headers = headers;
  }

  let response: Response;
  try {
    response = await fetch(input, requestInit);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON body (an HTML error page from a proxy, an empty 504). The
    // status still says what kind of failure it was.
  }

  const saysNotOk =
    body !== null &&
    typeof body === "object" &&
    (body as { ok?: unknown }).ok === false;

  if (!response.ok || saysNotOk || body === null) {
    throw new ApiError(
      errorMessageFrom(body, response.ok && body === null ? 500 : response.status),
      response.status,
      body,
    );
  }

  return body as T;
}

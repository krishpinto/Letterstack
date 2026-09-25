/**
 * One response shape for the whole /api/v1 tree.
 *
 * Every failure carries a stable machine-readable `code`. That is the part
 * an integrator branches on; the `message` is for a human reading a log and
 * is free to be reworded. Returning prose alone forces customers to
 * string-match, and then the wording can never change again.
 *
 * (A third `docs` field belongs here once /docs/api exists. Pointing every
 * error at a 404 in the meantime would be worse than leaving it out.)
 */
import { NextResponse } from "next/server";

export type ApiErrorCode =
  // Authentication and authorization
  | "missing_api_key"
  | "invalid_api_key"
  | "insufficient_scope"
  // Plan and rate limits
  | "upgrade_required"
  | "quota_exceeded"
  | "rate_limited"
  | "contact_limit_reached"
  // Request problems
  | "invalid_request"
  | "not_found"
  | "method_not_allowed"
  // Ours, not theirs
  | "internal_error";

/**
 * API responses are never cached. A shared cache holding one key's contact
 * list and serving it to the next caller is the failure this prevents.
 */
const NO_STORE = { "Cache-Control": "no-store" } as const;

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  headers?: Record<string, string>,
): NextResponse {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: { ...NO_STORE, ...headers } },
  );
}

export function apiOk(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

/**
 * Parses a JSON body, or returns the error response to send back.
 *
 * Returned rather than thrown so the caller stays a plain function with no
 * try/catch around every read — `if ("error" in parsed) return parsed.error`.
 */
export async function readJsonBody<T = Record<string, unknown>>(
  request: Request,
): Promise<{ body: T } | { error: NextResponse }> {
  try {
    const body = await request.json();
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return {
        error: apiError(400, "invalid_request", "Request body must be a JSON object."),
      };
    }
    return { body: body as T };
  } catch {
    return {
      error: apiError(400, "invalid_request", "Request body must be valid JSON."),
    };
  }
}

/** Deliberately permissive — real rejection is the recipient's mail server. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : null;
}

// The editor's PATCH requests. Turns every way a save can go wrong into a
// SaveError the save queue understands, so no caller can mistake a failed
// save for a successful one again: a 404 for a sent campaign, a 401 after the
// session expired, an HTML error page that makes `res.json()` throw — each of
// these used to be logged and then reported as "Saved".

import { SaveError } from "./save-queue";

export type SaveResponse = {
  ok?: boolean;
  error?: string;
  code?: string;
  version?: string;
};

/** Classifies a non-successful save response. */
export function saveErrorFromResponse(status: number, data: SaveResponse | null): SaveError {
  if (status === 401) {
    return new SaveError(
      "unauthorized",
      "Your session has expired. Sign in again in another tab, then retry.",
    );
  }
  if (status === 409) {
    return new SaveError(
      data?.code === "locked" ? "locked" : "conflict",
      data?.error ?? "This document was changed somewhere else. Reload to get the latest version.",
    );
  }
  if (!data) {
    return new SaveError("failed", `The server sent an unexpected response (HTTP ${status}).`);
  }
  return new SaveError("failed", data.error || `Could not save (HTTP ${status}).`);
}

/**
 * Sends one save and resolves with the new version token. Rejects with a
 * SaveError on any failure.
 */
export async function patchDocument(
  url: string,
  body: Record<string, unknown>,
): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new SaveError("failed", "Could not reach the server. Check your connection, then retry.");
  }
  const data = (await res.json().catch(() => null)) as SaveResponse | null;
  if (!res.ok || !data?.ok) throw saveErrorFromResponse(res.status, data);
  return typeof data.version === "string" ? data.version : null;
}

// Browsers refuse keepalive bodies over 64KB (summed across in-flight
// keepalive requests). Leave headroom for other requests on the page.
const KEEPALIVE_BODY_LIMIT = 60_000;

/**
 * Best-effort save for when the page is going away and nothing can be
 * awaited. Uses `keepalive` so the request survives the page; a document too
 * large for that falls back to a normal request, which the browser may cancel.
 * Resolves with the new version if the page is still around to hear it.
 */
export function patchDocumentOnUnload(
  url: string,
  body: Record<string, unknown>,
): Promise<string | null> {
  const json = JSON.stringify(body);
  const fits = new TextEncoder().encode(json).length <= KEEPALIVE_BODY_LIMIT;
  return fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: json,
    keepalive: fits,
  })
    .then((res) => res.json() as Promise<SaveResponse>)
    .then((data) => (data?.ok && typeof data.version === "string" ? data.version : null))
    .catch(() => null);
}

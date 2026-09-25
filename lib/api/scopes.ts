/**
 * What an API key is allowed to do.
 *
 * Scopes exist here for one reason: blast radius. The worst case for a
 * leaked key is not someone reading a contact list — it is someone
 * triggering sends, which burns the monthly allowance and can push the
 * shared SES account past the 10% bounce / 0.5% complaint line, taking
 * every other customer's sending down with it. So sending is its own scope,
 * never granted by default, and the UI warns before enabling it.
 */
export const API_SCOPES = [
  "contacts:read",
  "contacts:write",
  "campaigns:read",
  "campaigns:send",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

/** Scopes a new key starts with when the caller doesn't choose. */
export const DEFAULT_SCOPES: ApiScope[] = ["contacts:read", "contacts:write"];

export const SCOPE_INFO: Record<
  ApiScope,
  { label: string; description: string; dangerous?: boolean }
> = {
  "contacts:read": {
    label: "Read contacts",
    description: "List the workspace's audience.",
  },
  "contacts:write": {
    label: "Write contacts",
    description: "Add, update, remove and unsubscribe contacts.",
  },
  "campaigns:read": {
    label: "Read campaigns",
    description: "List campaigns and read their delivery stats.",
  },
  "campaigns:send": {
    label: "Send campaigns",
    description:
      "Trigger a campaign send. A leaked key with this scope can spend the whole monthly email allowance.",
    dangerous: true,
  },
};

export function isApiScope(value: unknown): value is ApiScope {
  return typeof value === "string" && (API_SCOPES as readonly string[]).includes(value);
}

/**
 * Untrusted input to a scope list. Unknown entries are dropped rather than
 * rejected, so a client sending a scope from a newer version of the API
 * degrades to fewer permissions instead of failing shut.
 */
export function parseScopes(input: unknown): ApiScope[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<ApiScope>();
  for (const entry of input) if (isApiScope(entry)) seen.add(entry);
  return API_SCOPES.filter((scope) => seen.has(scope));
}

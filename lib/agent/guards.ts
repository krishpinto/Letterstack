// Pure checks for /api/agent/chat: request shape limits and the budget
// arithmetic. Kept apart from budget.ts (which talks to Postgres) so both can
// be unit-tested.

/**
 * Largest request body accepted, in characters. The client resends at most
 * three turns of history (HISTORY_TURNS in use-agent.ts) plus a document
 * summary, which lands in the tens of kilobytes. Everything in the body is
 * forwarded to the model as input tokens, so an unbounded body is an
 * unbounded bill.
 */
export const MAX_AGENT_BODY_CHARS = 512 * 1024;

/** Three turns of up to MAX_AGENT_STEPS model calls each, with headroom. */
export const MAX_AGENT_MESSAGES = 80;

/**
 * Tokens reserved for a call before it runs, for the part we can't measure
 * up front: the system prompt and the model's reply.
 */
export const RESERVED_OVERHEAD_TOKENS = 4_000;

/** Rough input size: ~4 characters per token for English text and JSON. */
export function estimateCallTokens(requestChars: number): number {
  return Math.ceil(Math.max(0, requestChars) / 4) + RESERVED_OVERHEAD_TOKENS;
}

export type AgentRequestCheck = { ok: true } | { ok: false; status: number; error: string };

export function checkAgentRequestShape(input: {
  bodyChars: number;
  messages: unknown;
}): AgentRequestCheck {
  if (input.bodyChars > MAX_AGENT_BODY_CHARS) {
    return { ok: false, status: 413, error: "This conversation is too long. Start a new chat." };
  }
  if (!Array.isArray(input.messages) || input.messages.length === 0) {
    return { ok: false, status: 400, error: "No messages provided." };
  }
  if (input.messages.length > MAX_AGENT_MESSAGES) {
    return { ok: false, status: 413, error: "This conversation is too long. Start a new chat." };
  }
  return { ok: true };
}

/** Usage counts read from the ledger. Every count INCLUDES this call's own reservation. */
export type BudgetCounts = {
  modelRequestsLastMinute: number;
  modelRequestsToday: number;
  modelTokensToday: number;
  userRequestsLastMinute: number;
  userTokensThisMonth: number;
};

export type BudgetLimits = {
  rpmLimit: number;
  dailyRequestLimit: number;
  dailyTokenLimit: number;
  /** Per-user calls per minute. One agent turn is at most MAX_AGENT_STEPS calls. */
  userRpmLimit: number;
  monthlyTokenLimit: number;
};

export type BudgetBreach =
  | "model-rpm"
  | "user-rpm"
  | "model-daily-requests"
  | "model-daily-tokens"
  | "user-monthly-tokens"
  | null;

/**
 * Which gate, if any, refuses this call.
 *
 * The counts already contain this call's reservation, because the
 * reservation is written BEFORE the counts are read. That ordering is the
 * point: if usage were written only after a call finished, ten parallel
 * requests would each read the same old totals and all pass. Written first,
 * each one sees the others. In a tight race two calls can both see each
 * other and both be refused; that errs on the safe side, never over.
 *
 * So a request gate passes when the count of OTHER calls is under the limit
 * (count - 1 < limit, i.e. count <= limit). A token gate passes when usage
 * before this call is under the limit, as it did before reservations
 * existed: the estimate is held against later calls, not this one.
 */
export function budgetBreach(
  counts: BudgetCounts,
  limits: BudgetLimits,
  ownReservedTokens: number,
): BudgetBreach {
  if (counts.modelRequestsLastMinute > limits.rpmLimit) return "model-rpm";
  if (counts.userRequestsLastMinute > limits.userRpmLimit) return "user-rpm";
  if (counts.modelRequestsToday > limits.dailyRequestLimit) return "model-daily-requests";
  if (counts.modelTokensToday - ownReservedTokens >= limits.dailyTokenLimit) {
    return "model-daily-tokens";
  }
  if (counts.userTokensThisMonth - ownReservedTokens >= limits.monthlyTokenLimit) {
    return "user-monthly-tokens";
  }
  return null;
}

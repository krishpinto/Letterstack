// The three quota gates, checked before every model call.
//
// The distinction that matters: the quota that actually breaks is *global*, not
// per-user. A free provider tier limits requests per day on our one API key,
// shared by every user in the product. A per-user token budget is fairness
// between users; it does not protect the shared allowance. So we check both,
// plus a rolling per-minute limit, cheapest query first.
//
// All three are COUNT queries over ai_usage in Postgres. See the schema comment
// for why there's no Redis here.

import { and, count, eq, gte, sql, sum } from "drizzle-orm";

import { db } from "@/db/client";
import { aiBudgets, aiUsage } from "@/db/schema";

/**
 * Daily ceiling across all users. Deliberately below the provider's actual free
 * limit so a burst near midnight can't push us into hard 429s — and so the
 * whole allowance isn't spent by the agent panel alone.
 */
export const GLOBAL_DAILY_REQUEST_LIMIT = Number(
  process.env.AI_DAILY_REQUEST_LIMIT ?? 1_200,
);

/**
 * Rolling per-minute ceiling. Providers cap somewhere around 10–30 RPM.
 *
 * This must stay comfortably above MAX_AGENT_STEPS, or a single multi-step turn
 * eats most of the minute and the user's very next message is refused. At the
 * old value of 10 against a step ceiling of 8 that was close to guaranteed.
 */
export const GLOBAL_RPM_LIMIT = Number(process.env.AI_RPM_LIMIT ?? 20);

/**
 * Applied to users with no ai_budgets row.
 *
 * One agent turn costs several model calls, and each carries the conversation
 * plus a document summary — so real turns land in the thousands of tokens, not
 * the hundreds. The original 200k ceiling was consumed 65% of the way in
 * seventeen calls of ordinary use, which reads to the user as the assistant
 * mysteriously dying. This is sized so the daily request gates bind first,
 * since those are what actually protect the shared provider quota.
 */
export const DEFAULT_MONTHLY_TOKEN_LIMIT = Number(
  process.env.AI_MONTHLY_TOKEN_LIMIT ?? 5_000_000,
);

export type BudgetVerdict =
  | { ok: true; tokensUsed: number; tokenLimit: number; requestsToday: number }
  | { ok: false; reason: string; retryAfterSeconds?: number };

async function countSince(since: Date): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(aiUsage)
    .where(gte(aiUsage.createdAt, since));
  return row?.value ?? 0;
}

function startOfUtcDay(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function startOfUtcMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

async function monthlyTokenLimitFor(userId: string): Promise<number> {
  const [row] = await db
    .select({ limit: aiBudgets.monthlyTokenLimit })
    .from(aiBudgets)
    .where(eq(aiBudgets.userId, userId))
    .limit(1);
  return row?.limit ?? DEFAULT_MONTHLY_TOKEN_LIMIT;
}

async function tokensUsedThisMonth(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: sum(aiUsage.totalTokens) })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), gte(aiUsage.createdAt, startOfUtcMonth())));
  // sum() returns a numeric string, or null when no rows matched.
  return Number(row?.total ?? 0);
}

/**
 * Run all three gates. Messages are written to be shown to the user verbatim —
 * a quota refusal should say what happened and when it clears, never fail
 * silently or pretend the model errored.
 */
export async function checkAgentBudget(userId: string): Promise<BudgetVerdict> {
  const perMinute = await countSince(new Date(Date.now() - 60_000));
  if (perMinute >= GLOBAL_RPM_LIMIT) {
    return {
      ok: false,
      reason: "The assistant is handling a lot of requests right now. Try again in a few seconds.",
      retryAfterSeconds: 15,
    };
  }

  const requestsToday = await countSince(startOfUtcDay());
  if (requestsToday >= GLOBAL_DAILY_REQUEST_LIMIT) {
    return {
      ok: false,
      reason:
        "The assistant has reached its daily limit for everyone on this workspace. It resets at midnight UTC.",
    };
  }

  const [tokenLimit, tokensUsed] = await Promise.all([
    monthlyTokenLimitFor(userId),
    tokensUsedThisMonth(userId),
  ]);

  if (tokensUsed >= tokenLimit) {
    return {
      ok: false,
      reason: "You've used your AI allowance for this month.",
    };
  }

  return { ok: true, tokensUsed, tokenLimit, requestsToday };
}

export type RecordUsageInput = {
  organizationId: string;
  userId: string;
  provider: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  campaignId?: string | null;
  ok?: boolean;
  error?: string | null;
};

/**
 * Write one ledger row. Never throws: usage accounting failing must not take
 * down a response the user already received.
 */
export async function recordAgentUsage(input: RecordUsageInput): Promise<void> {
  const prompt = Math.max(0, Math.round(input.promptTokens ?? 0));
  const completion = Math.max(0, Math.round(input.completionTokens ?? 0));

  try {
    await db.insert(aiUsage).values({
      organizationId: input.organizationId,
      userId: input.userId,
      provider: input.provider,
      model: input.model,
      promptTokens: prompt,
      completionTokens: completion,
      // Providers don't always report a total; derive it rather than store 0,
      // which would make a user's spend look free.
      totalTokens: Math.max(0, Math.round(input.totalTokens ?? prompt + completion)),
      campaignId: input.campaignId ?? null,
      ok: input.ok ?? true,
      error: input.error ?? null,
    });
  } catch (err) {
    console.error("Failed to record AI usage", err);
  }
}

export type BudgetSnapshot = {
  tokensUsed: number;
  tokenLimit: number;
  requestsToday: number;
  dailyRequestLimit: number;
};

/** Powers the budget meter in the agent panel. */
export async function agentBudgetSnapshot(userId: string): Promise<BudgetSnapshot> {
  const [tokenLimit, tokensUsed, requestsToday] = await Promise.all([
    monthlyTokenLimitFor(userId),
    tokensUsedThisMonth(userId),
    countSince(startOfUtcDay()),
  ]);
  return {
    tokensUsed,
    tokenLimit,
    requestsToday,
    dailyRequestLimit: GLOBAL_DAILY_REQUEST_LIMIT,
  };
}

// Kept for callers that want a raw expression rather than the helpers above.
export const usageSinceExpr = (since: Date) => sql`${aiUsage.createdAt} >= ${since}`;

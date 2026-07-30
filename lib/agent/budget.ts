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
import { AGENT_MODELS, findModel } from "./models";

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

/** Requests for one model since a point in time. */
async function countSince(since: Date, model?: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(aiUsage)
    .where(
      model
        ? and(gte(aiUsage.createdAt, since), eq(aiUsage.model, model))
        : gte(aiUsage.createdAt, since),
    );
  return row?.value ?? 0;
}

/** Tokens spent on one model since a point in time. */
async function tokensSince(since: Date, model: string): Promise<number> {
  const [row] = await db
    .select({ total: sum(aiUsage.totalTokens) })
    .from(aiUsage)
    .where(and(gte(aiUsage.createdAt, since), eq(aiUsage.model, model)));
  return Number(row?.total ?? 0);
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
export async function checkAgentBudget(
  userId: string,
  modelId: string,
): Promise<BudgetVerdict> {
  const model = findModel(modelId);
  const rpmLimit = model?.rpmLimit ?? 10;
  const dailyLimit = model?.dailyRequestLimit ?? 1000;

  const perMinute = await countSince(new Date(Date.now() - 60_000), modelId);
  if (perMinute >= rpmLimit) {
    return {
      ok: false,
      reason: `${model?.label ?? modelId} is being called too quickly. Give it a few seconds, or switch model.`,
      retryAfterSeconds: 15,
    };
  }

  // Each model has its own allowance, so naming an alternative is genuinely
  // actionable rather than a consolation.
  const alternatives = AGENT_MODELS.filter((m) => m.id !== modelId)
    .map((m) => m.label)
    .join(" or ");

  const dayStart = startOfUtcDay();
  const [requestsToday, tokensToday] = await Promise.all([
    countSince(dayStart, modelId),
    tokensSince(dayStart, modelId),
  ]);

  if (requestsToday >= dailyLimit) {
    return {
      ok: false,
      reason: `${model?.label ?? modelId} has used its daily request quota (${dailyLimit}). It resets at midnight UTC — until then, switch to ${alternatives} from the model picker.`,
    };
  }

  // Tokens, not requests, are what actually exhaust an agent workload: turns
  // carry document context and history, so they burn tokens fast while barely
  // denting the request count.
  const tokenLimitToday = model?.dailyTokenLimit ?? 250_000;
  if (tokensToday >= tokenLimitToday) {
    return {
      ok: false,
      reason: `${model?.label ?? modelId} has used its daily token allowance (${tokensToday.toLocaleString()} of ~${tokenLimitToday.toLocaleString()}). It resets at midnight UTC — until then, switch to ${alternatives} from the model picker.`,
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

export type ModelQuota = {
  id: string;
  label: string;
  requestsToday: number;
  dailyRequestLimit: number;
  tokensToday: number;
  dailyTokenLimit: number;
  requestsLastMinute: number;
  rpmLimit: number;
  /** Calendar-month totals, for cost projection rather than throttling. */
  monthCalls: number;
  monthTokens: number;
  exhausted: boolean;
  /** Which ceiling ran out, so the UI doesn't have to re-derive it. */
  exhaustedBy: "requests" | "tokens" | null;
};

/**
 * Per-model quota for the admin monitor.
 *
 * Every model is listed even with zero usage — an empty row is the useful
 * answer to "what can I switch to?" when the model you were using runs out.
 */
export async function modelQuotas(): Promise<ModelQuota[]> {
  const dayStart = startOfUtcDay();
  const monthStart = startOfUtcMonth();
  const minuteAgo = new Date(Date.now() - 60_000);

  const monthRows = await db
    .select({
      model: aiUsage.model,
      calls: count(),
      tokens: sum(aiUsage.totalTokens),
    })
    .from(aiUsage)
    .where(gte(aiUsage.createdAt, monthStart))
    .groupBy(aiUsage.model);

  const monthBy = new Map(
    monthRows.map((row) => [
      row.model,
      { calls: Number(row.calls ?? 0), tokens: Number(row.tokens ?? 0) },
    ]),
  );

  return Promise.all(
    AGENT_MODELS.map(async (model) => {
      const [requestsToday, requestsLastMinute, tokensToday] = await Promise.all([
        countSince(dayStart, model.id),
        countSince(minuteAgo, model.id),
        tokensSince(dayStart, model.id),
      ]);
      const month = monthBy.get(model.id);
      const outOfRequests = requestsToday >= model.dailyRequestLimit;
      const outOfTokens = tokensToday >= model.dailyTokenLimit;
      return {
        id: model.id,
        label: model.label,
        requestsToday,
        dailyRequestLimit: model.dailyRequestLimit,
        tokensToday,
        dailyTokenLimit: model.dailyTokenLimit,
        requestsLastMinute,
        rpmLimit: model.rpmLimit,
        monthCalls: month?.calls ?? 0,
        monthTokens: month?.tokens ?? 0,
        exhausted: outOfRequests || outOfTokens,
        exhaustedBy: outOfRequests ? ("requests" as const) : outOfTokens ? ("tokens" as const) : null,
      };
    }),
  );
}

export type BudgetSnapshot = {
  tokensUsed: number;
  tokenLimit: number;
};

/** Powers the budget meter in the agent panel. */
export async function agentBudgetSnapshot(userId: string): Promise<BudgetSnapshot> {
  const [tokenLimit, tokensUsed] = await Promise.all([
    monthlyTokenLimitFor(userId),
    tokensUsedThisMonth(userId),
  ]);
  return { tokensUsed, tokenLimit };
}

// Kept for callers that want a raw expression rather than the helpers above.
export const usageSinceExpr = (since: Date) => sql`${aiUsage.createdAt} >= ${since}`;

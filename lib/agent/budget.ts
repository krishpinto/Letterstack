// The quota gates, checked before every model call.
//
// The distinction that matters: the quota that actually breaks is *global*, not
// per-user. A free provider tier limits requests per day on our one API key,
// shared by every user in the product. A per-user token budget is fairness
// between users; it does not protect the shared allowance. So we check both,
// plus rolling per-minute limits per model and per user.
//
// All of them are COUNT/SUM queries over ai_usage in Postgres. See the schema
// comment for why there's no Redis here.
//
// Every call is reserved before it is checked: a ledger row carrying an
// estimated token count is written first, the gates are evaluated with that
// row included, and the row is settled with real usage when the call ends
// (or deleted if the gates refuse). Recording only after completion let any
// number of parallel requests read the same pre-call totals and all pass.
// The arithmetic lives in ./guards.ts.

import { and, count, eq, gte, sql, sum } from "drizzle-orm";

import { db } from "@/db/client";
import { aiBudgets, aiUsage } from "@/db/schema";
import { budgetBreach } from "./guards";
import { AGENT_MODELS, findModel, MAX_AGENT_STEPS } from "./models";

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

/** Requests by one user, across every model, since a point in time. */
async function userCountSince(userId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), gte(aiUsage.createdAt, since)));
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
 * Run every gate for a call whose reservation (see reserveAgentCall) has
 * already been written. Messages are written to be shown to the user
 * verbatim — a quota refusal should say what happened and when it clears,
 * never fail silently or pretend the model errored.
 */
export async function checkAgentBudget(
  userId: string,
  modelId: string,
  ownReservedTokens: number,
): Promise<BudgetVerdict> {
  const model = findModel(modelId);
  const rpmLimit = model?.rpmLimit ?? 10;
  const dailyLimit = model?.dailyRequestLimit ?? 1000;
  const tokenLimitToday = model?.dailyTokenLimit ?? 250_000;

  const minuteAgo = new Date(Date.now() - 60_000);
  const dayStart = startOfUtcDay();
  const [
    modelRequestsLastMinute,
    userRequestsLastMinute,
    modelRequestsToday,
    modelTokensToday,
    monthlyTokenLimit,
    userTokensThisMonth,
  ] = await Promise.all([
    countSince(minuteAgo, modelId),
    userCountSince(userId, minuteAgo),
    countSince(dayStart, modelId),
    tokensSince(dayStart, modelId),
    monthlyTokenLimitFor(userId),
    tokensUsedThisMonth(userId),
  ]);

  const breach = budgetBreach(
    {
      modelRequestsLastMinute,
      modelRequestsToday,
      modelTokensToday,
      userRequestsLastMinute,
      userTokensThisMonth,
    },
    {
      rpmLimit,
      dailyRequestLimit: dailyLimit,
      dailyTokenLimit: tokenLimitToday,
      // One turn is at most MAX_AGENT_STEPS calls, so a person never needs
      // more than that in a minute. The step counter in the request body is
      // the client's to fake; this ledger count is not.
      userRpmLimit: MAX_AGENT_STEPS,
      monthlyTokenLimit,
    },
    ownReservedTokens,
  );

  // Each model has its own allowance, so naming an alternative is genuinely
  // actionable rather than a consolation.
  const alternatives = AGENT_MODELS.filter((m) => m.id !== modelId)
    .map((m) => m.label)
    .join(" or ");
  const label = model?.label ?? modelId;

  switch (breach) {
    case "model-rpm":
      return {
        ok: false,
        reason: `${label} is being called too quickly. Give it a few seconds, or switch model.`,
        retryAfterSeconds: 15,
      };
    case "user-rpm":
      return {
        ok: false,
        reason:
          "You're sending requests faster than one conversation needs. Wait a minute and try again.",
        retryAfterSeconds: 60,
      };
    case "model-daily-requests":
      return {
        ok: false,
        reason: `${label} has used its daily request quota (${dailyLimit}). It resets at midnight UTC — until then, switch to ${alternatives} from the model picker.`,
      };
    case "model-daily-tokens": {
      // Tokens, not requests, are what actually exhaust an agent workload:
      // turns carry document context and history, so they burn tokens fast
      // while barely denting the request count.
      const used = Math.max(0, modelTokensToday - ownReservedTokens);
      return {
        ok: false,
        reason: `${label} has used its daily token allowance (${used.toLocaleString()} of ~${tokenLimitToday.toLocaleString()}). It resets at midnight UTC — until then, switch to ${alternatives} from the model picker.`,
      };
    }
    case "user-monthly-tokens":
      return { ok: false, reason: "You've used your AI allowance for this month." };
    case null:
      return {
        ok: true,
        tokensUsed: Math.max(0, userTokensThisMonth - ownReservedTokens),
        tokenLimit: monthlyTokenLimit,
        requestsToday: modelRequestsToday,
      };
  }
}

/**
 * Write the ledger row for a call before it runs, holding `estimatedTokens`
 * against every budget until settleAgentCall replaces it with real usage.
 * If the call never settles (the function is killed mid-stream), the
 * estimate stays, which errs toward counting the call rather than losing it.
 */
export async function reserveAgentCall(input: {
  organizationId: string;
  userId: string;
  provider: string;
  model: string;
  campaignId?: string | null;
  estimatedTokens: number;
}): Promise<string> {
  const [row] = await db
    .insert(aiUsage)
    .values({
      organizationId: input.organizationId,
      userId: input.userId,
      provider: input.provider,
      model: input.model,
      totalTokens: Math.max(0, Math.round(input.estimatedTokens)),
      campaignId: input.campaignId ?? null,
      ok: true,
    })
    .returning({ id: aiUsage.id });
  return row.id;
}

/**
 * Drop a reservation the gates refused. Refusals are deliberately not left
 * in the ledger: it is the source of truth for the gates, and counting
 * refusals would make them compound into more refusals.
 */
export async function cancelAgentReservation(id: string): Promise<void> {
  try {
    await db.delete(aiUsage).where(eq(aiUsage.id, id));
  } catch (err) {
    console.error("Failed to cancel AI usage reservation", err);
  }
}

/**
 * Replace a reservation's estimate with what the call actually used. Never
 * throws: accounting failing must not take down a response the user already
 * received.
 */
export async function settleAgentCall(
  id: string,
  usage: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    ok?: boolean;
    error?: string | null;
  },
): Promise<void> {
  const prompt = Math.max(0, Math.round(usage.promptTokens ?? 0));
  const completion = Math.max(0, Math.round(usage.completionTokens ?? 0));
  try {
    await db
      .update(aiUsage)
      .set({
        promptTokens: prompt,
        completionTokens: completion,
        // Providers don't always report a total; derive it rather than store
        // 0, which would make a user's spend look free.
        totalTokens: Math.max(0, Math.round(usage.totalTokens ?? prompt + completion)),
        ok: usage.ok ?? true,
        error: usage.error ?? null,
      })
      .where(eq(aiUsage.id, id));
  } catch (err) {
    console.error("Failed to settle AI usage", err);
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

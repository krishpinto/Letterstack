import { NextResponse } from "next/server";
import { GetAccountCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { UTApi } from "uploadthing/server";
import { and, count, eq, gte, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  aiUsage,
  automations,
  campaignRecipients,
  campaigns,
  emailEvents,
  organizations,
  recipients,
  suppressedEmails,
  users,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { modelQuotas } from "@/lib/agent/budget";

export const runtime = "nodejs";

// Founder-only infra monitor. Access = signed in AND email in ADMIN_EMAILS
// (comma-separated env var, set in .env.local and Vercel).

async function sesAccount() {
  const client = new SESv2Client({ region: process.env.AWS_REGION });
  const account = await client.send(new GetAccountCommand({}));
  return {
    sendingEnabled: account.SendingEnabled ?? false,
    productionAccess: account.ProductionAccessEnabled ?? false,
    // Quota resets on a rolling 24h window.
    sentLast24h: account.SendQuota?.SentLast24Hours ?? 0,
    max24h: account.SendQuota?.Max24HourSend ?? 0,
    maxSendRate: account.SendQuota?.MaxSendRate ?? 0,
    enforcementStatus: account.EnforcementStatus ?? "UNKNOWN",
  };
}

/** Bounce/complaint rates from our own event log (SES suspends at 10% / 0.5%). */
async function reputation(sinceDays: number) {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ type: emailEvents.type, n: count() })
    .from(emailEvents)
    .where(gte(emailEvents.createdAt, since))
    .groupBy(emailEvents.type);

  const by = Object.fromEntries(rows.map((r) => [r.type, Number(r.n)]));
  const delivered = by["Delivery"] ?? 0;
  const bounced = by["Bounce"] ?? 0;
  const complaints = by["Complaint"] ?? 0;
  const accepted = delivered + bounced;

  return {
    delivered,
    bounced,
    complaints,
    bounceRate: accepted > 0 ? (bounced / accepted) * 100 : 0,
    complaintRate: delivered > 0 ? (complaints / delivered) * 100 : 0,
  };
}

/** Rough QStash usage today: campaign batches + scheduled hops. Estimate only. */
async function qstashEstimate() {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const [[sentToday], [scheduled]] = await Promise.all([
    db
      .select({ n: count() })
      .from(campaignRecipients)
      .where(gte(campaignRecipients.sentAt, dayStart)),
    db
      .select({ n: count() })
      .from(campaigns)
      .where(sql`${campaigns.status} = 'scheduled'`),
  ]);

  const batches = Math.ceil(Number(sentToday?.n ?? 0) / 50);
  return {
    estimatedMessagesToday: batches + Number(scheduled?.n ?? 0),
    dailyLimit: 500,
    note: "Estimated from batches sent today — automations and retries add more. Exact usage is in the Upstash console.",
  };
}

async function uploadthingUsage() {
  const utapi = new UTApi();
  const usage = await utapi.getUsageInfo();
  return {
    usedBytes: usage.totalBytes ?? 0,
    limitBytes: usage.limitBytes ?? 2 * 1024 * 1024 * 1024,
    filesUploaded: usage.filesUploaded ?? 0,
  };
}

async function neonUsage() {
  const result = await db.execute(
    sql`select pg_database_size(current_database())::text as bytes`,
  );
  const row = result.rows[0] as { bytes: string } | undefined;
  return {
    usedBytes: Number(row?.bytes ?? 0),
    // Neon free plan storage allowance.
    limitBytes: 512 * 1024 * 1024,
  };
}

/**
 * Gemini quota, per model.
 *
 * Google meters each model separately, so a single combined number hides the
 * thing you actually need to know when the assistant stops: *which* model ran
 * out, and which one still has room. Tokens are reported alongside for cost
 * projection, but requests-per-day is what stops the assistant working.
 */
async function geminiUsage() {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [models, [failures]] = await Promise.all([
    modelQuotas(),
    db
      .select({ n: count() })
      .from(aiUsage)
      .where(and(gte(aiUsage.createdAt, monthStart), eq(aiUsage.ok, false))),
  ]);

  const monthCalls = models.reduce((sum, m) => sum + m.monthCalls, 0);
  const monthTokens = models.reduce((sum, m) => sum + m.monthTokens, 0);

  return {
    models,
    monthCalls,
    monthTokens,
    // Average cost of a call is the early-warning signal for context bloat.
    avgTokensPerCall: monthCalls > 0 ? Math.round(monthTokens / monthCalls) : 0,
    failuresThisMonth: Number(failures?.n ?? 0),
  };
}

async function platformStats() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [
    [usersRow],
    [usersNewRow],
    [orgsRow],
    [recipientsRow],
    [campaignsRow],
    [sentRow],
    [suppressedRow],
    [automationsRow],
  ] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(users).where(gte(users.createdAt, weekAgo)),
    db.select({ n: count() }).from(organizations),
    db.select({ n: count() }).from(recipients),
    db.select({ n: count() }).from(campaigns),
    db
      .select({ n: count() })
      .from(campaigns)
      .where(sql`${campaigns.status} = 'sent'`),
    db.select({ n: count() }).from(suppressedEmails),
    db.select({ n: count() }).from(automations),
  ]);

  return {
    users: Number(usersRow?.n ?? 0),
    usersLast7d: Number(usersNewRow?.n ?? 0),
    organizations: Number(orgsRow?.n ?? 0),
    recipients: Number(recipientsRow?.n ?? 0),
    campaigns: Number(campaignsRow?.n ?? 0),
    campaignsSent: Number(sentRow?.n ?? 0),
    suppressed: Number(suppressedRow?.n ?? 0),
    automations: Number(automationsRow?.n ?? 0),
  };
}

/** Each block resolves independently so one failing provider can't blank the page. */
async function tryBlock<T>(fn: () => Promise<T>) {
  try {
    return { ok: true as const, data: await fn() };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "failed",
    };
  }
}

export async function GET() {
  const session = await auth();
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const [ses, rep7, rep30, qstash, uploads, neon, platform, gemini] =
    await Promise.all([
      tryBlock(sesAccount),
      tryBlock(() => reputation(7)),
      tryBlock(() => reputation(30)),
      tryBlock(qstashEstimate),
      tryBlock(uploadthingUsage),
      tryBlock(neonUsage),
      tryBlock(platformStats),
      tryBlock(geminiUsage),
    ]);

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    ses,
    reputation7d: rep7,
    reputation30d: rep30,
    qstash,
    uploadthing: uploads,
    neon,
    platform,
    gemini,
  });
}

import {
  claimCampaignForSending,
  claimDispatchRound,
  getCampaign,
  revertCampaignClaim,
} from "@/db/campaigns";
import {
  failPendingRecipients,
  listRecipientStates,
  readSendableAudience,
  recipientStatusCounts,
} from "@/db/campaign-recipients";
import {
  getSendUsage,
  releaseSendQuota,
  startTrialClockOnFirstSend,
  tryReserveSendQuota,
} from "@/db/organizations";
import {
  getMailbox,
  getMailboxSendUsage,
  releaseMailboxQuota,
  tryReserveMailboxQuota,
} from "@/db/connected-mailboxes";
import { notifyAdminsOfCampaignSend } from "@/lib/admin-notify";
import { publishSesBatches, type FrozenContent, type QueueResult } from "./send-campaign";
import { publishGmailRun } from "./gmail-campaign";
import { settleCampaign } from "./qstash-worker";
import { RESUME_COOLDOWN_MS } from "./send-policy";

/**
 * A send the user has to fix before it can go: no recipients, not enough
 * quota, a sender that cannot send. The message is written for the person
 * who pressed Send.
 */
export class SendRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SendRefusedError";
  }
}

/**
 * The campaign is sending, but some of this round's batches did not make it
 * onto the queue. Nothing is lost: the rows are still pending, and running
 * the round again (a QStash retry of the scheduled dispatch, or Resume)
 * queues only what is missing.
 */
export class QueueIncompleteError extends Error {
  constructor(public result: QueueResult) {
    super(
      `Queued ${result.queued} of ${result.total} batches. The rest are still pending; press Resume to queue them.`,
    );
    this.name = "QueueIncompleteError";
  }
}

/** Who asked for the send. A schedule can only start a campaign still "scheduled". */
export type DispatchTrigger = "now" | "schedule";

export type DispatchResult =
  | { outcome: "started"; total: number; batches: number }
  /** Another request claimed the campaign first; this one did nothing. */
  | { outcome: "already_sending" };

type Campaign = NonNullable<Awaited<ReturnType<typeof getCampaign>>>;

/** One channel's quota and queueing, so each sequence below is written once. */
type Channel = {
  reserve(count: number): Promise<void>;
  release(count: number): Promise<void>;
  /** Queue this round's pending work. Never reserves anything. */
  queue(dispatchKey: string): Promise<QueueResult>;
};

function overQuotaMessage(count: number, used: number, limit: number) {
  const remaining = Math.max(0, limit - used);
  return (
    `This send is ${count.toLocaleString()} emails but only ${remaining.toLocaleString()} of your ${limit.toLocaleString()} monthly emails are left. ` +
    `Upgrade in Settings → Billing, or send to a smaller group.`
  );
}

async function reserveOrgQuota(organizationId: string, count: number) {
  // All-or-nothing: reserve the whole audience up front so a campaign is
  // never cut off partway through its list for no reason the sender can see.
  if (await tryReserveSendQuota(organizationId, count)) return;
  // Read usage only on the refusal path, so the happy path stays one query.
  const usage = await getSendUsage(organizationId);
  throw new SendRefusedError(overQuotaMessage(count, usage.used, usage.limit));
}

function sesChannel(campaign: Campaign): Channel {
  const content: FrozenContent = {
    subject: campaign.subject,
    html: campaign.htmlSnapshot,
    text: campaign.textSnapshot,
    fromName: campaign.fromName,
    fromEmail: campaign.fromEmail,
  };
  return {
    reserve: (count) => reserveOrgQuota(campaign.organizationId, count),
    release: (count) => releaseSendQuota(campaign.organizationId, count),
    queue: async (dispatchKey) =>
      publishSesBatches({
        content,
        userId: campaign.userId,
        organizationId: campaign.organizationId,
        campaignId: campaign.id,
        dispatchKey,
        recipients: await listRecipientStates(campaign.id),
      }),
  };
}

async function gmailChannel(campaign: Campaign): Promise<Channel> {
  if (!campaign.mailboxId) {
    throw new SendRefusedError("This campaign isn't set to send through a connected Gmail account");
  }
  const mailbox = await getMailbox(campaign.mailboxId);
  if (!mailbox || mailbox.organizationId !== campaign.organizationId) {
    throw new SendRefusedError("The connected Gmail account for this campaign was not found");
  }
  if (mailbox.status !== "active") {
    throw new SendRefusedError(
      mailbox.status === "revoked"
        ? "This Gmail account is no longer connected. Reconnect it or choose a different sender."
        : "This Gmail account needs to be reconnected before it can send.",
    );
  }

  const content: FrozenContent = {
    subject: campaign.subject,
    html: campaign.htmlSnapshot,
    text: campaign.textSnapshot,
    fromName: campaign.fromName,
    fromEmail: mailbox.email,
    replyTo: campaign.replyTo ?? undefined,
  };

  return {
    async reserve(count) {
      // Two ceilings, both enforced: the mailbox's own daily cap (checked
      // first — cheaper to fail) and the org's monthly plan allowance.
      // Skipping the second would let one connected mailbox send far more
      // per month than the org's plan allows.
      if (!(await tryReserveMailboxQuota(mailbox.id, count))) {
        const usage = await getMailboxSendUsage(mailbox.id);
        const remaining = Math.max(0, usage.limit - usage.used);
        throw new SendRefusedError(
          `This send is ${count.toLocaleString()} emails but your Gmail account can only send ` +
            `${remaining.toLocaleString()} more today (its own ${usage.limit.toLocaleString()}/day limit). ` +
            `Try a smaller list, or send the rest tomorrow.`,
        );
      }
      try {
        await reserveOrgQuota(campaign.organizationId, count);
      } catch (err) {
        await releaseMailboxQuota(mailbox.id, count);
        throw err;
      }
    },
    async release(count) {
      await releaseMailboxQuota(mailbox.id, count);
      await releaseSendQuota(campaign.organizationId, count);
    },
    queue: async (dispatchKey) =>
      publishGmailRun({
        content,
        userId: campaign.userId,
        organizationId: campaign.organizationId,
        mailboxId: mailbox.id,
        campaignId: campaign.id,
        dispatchKey,
        recipients: await listRecipientStates(campaign.id),
      }),
  };
}

function channelFor(campaign: Campaign): Promise<Channel> | Channel {
  return campaign.senderType === "mailbox" ? gmailChannel(campaign) : sesChannel(campaign);
}

/** The key that names a dispatch round in QStash deduplication ids. */
function dispatchKeyOf(dispatchedAt: Date): string {
  return String(dispatchedAt.getTime());
}

/**
 * Single entry point for "Send now" and the scheduled dispatch. Routes to
 * the SES or Gmail channel based on the campaign's own senderType, so
 * neither caller has to know or duplicate that branch.
 *
 * Order matters:
 *   1. read the audience and reserve quota for it,
 *   2. claim the campaign with one guarded UPDATE,
 *   3. only the winner fails suppressed rows and queues batches.
 * Reserving before claiming means a crash between the two can only ever
 * over-count quota, never send without it. A request that loses the claim
 * hands its reservation straight back.
 */
export async function dispatchCampaign(
  campaignId: string,
  trigger: DispatchTrigger,
): Promise<DispatchResult> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error("Campaign not found");

  const from = trigger === "schedule" ? ["scheduled"] : ["draft", "scheduled"];
  if (!from.includes(campaign.status)) return { outcome: "already_sending" };

  const channel = await channelFor(campaign);

  const { allowed, suppressed } = await readSendableAudience(campaignId, campaign.organizationId);
  if (allowed.length === 0) {
    throw new SendRefusedError(
      suppressed.length > 0
        ? "Every recipient on this campaign is on the suppression list, so there is no one to send to."
        : "Add at least one recipient before sending",
    );
  }

  await channel.reserve(allowed.length);

  const dispatchedAt = await claimCampaignForSending(campaignId, from);
  if (!dispatchedAt) {
    await channel.release(allowed.length);
    return { outcome: "already_sending" };
  }

  await failPendingRecipients(
    suppressed.map((row) => row.id),
    "suppressed",
  );

  // First send starts the free Pro countdown. After the first this is a
  // no-op: the guard lives in the statement.
  await startTrialClockOnFirstSend(campaign.organizationId);

  const queued = await channel.queue(dispatchKeyOf(dispatchedAt));

  if (queued.queued === 0 && trigger === "now") {
    // Nothing reached the queue (QStash down), so no worker can be holding
    // a row: put the campaign back and hand the quota back, and the person
    // who pressed Send gets an error they can retry. A scheduled dispatch
    // keeps its claim instead and lets QStash retry it; see
    // ensureCampaignQueued.
    await revertCampaignClaim(campaignId, campaign.status);
    await channel.release(allowed.length);
    throw new Error("Could not queue the send. Nothing was sent; try again in a minute.");
  }

  // After the send is committed, never before: a notification for a send
  // that did not happen is worse than none. Awaited because a serverless
  // function can freeze the moment it returns; the call swallows its own
  // errors, so it cannot fail the send it reports.
  if (queued.queued > 0) await notifyAdminsOfCampaignSend(campaignId);

  if (queued.queued < queued.total) throw new QueueIncompleteError(queued);

  return { outcome: "started", total: allowed.length, batches: queued.total };
}

export type ResumeResult =
  | { outcome: "resumed"; pending: number; batches: number }
  /** Every row is sent, failed, or in a worker's hands right now. */
  | { outcome: "nothing_to_resume"; inFlight: number }
  /** A round started less than RESUME_COOLDOWN_MS ago. */
  | { outcome: "too_soon" }
  | { outcome: "not_sending" };

/**
 * Re-queue whatever a sending campaign has left — the server side of the
 * "Resume send" button. Safe to call at any time:
 *
 *   - It reserves no quota. Every pending row was reserved when the send
 *     started, and is released only when it fails without reaching the
 *     provider, at which point it is no longer pending.
 *   - It queues only rows still "pending". A row a worker is sending right
 *     now is "sending" and is left alone, and if a batch it re-queues is
 *     also still sitting in QStash's retry backoff, whichever copy runs
 *     first claims each row and the other skips it.
 *   - Two Resumes in a row start one round, not two (claimDispatchRound).
 */
export async function resumeCampaign(campaignId: string): Promise<ResumeResult> {
  const campaign = await getCampaign(campaignId);
  if (!campaign || campaign.status !== "sending") return { outcome: "not_sending" };

  // Settle first: fails claims whose worker is long gone, and closes the
  // campaign if that was all it was waiting for.
  const { inFlight } = await settleCampaign(campaignId);
  const counts = await recipientStatusCounts(campaignId);
  if (counts.pending === 0) return { outcome: "nothing_to_resume", inFlight };

  // Validate the sender before starting a round: a Gmail account that still
  // needs reconnecting should say so, not queue a run that halts at once.
  const channel = await channelFor(campaign);

  const dispatchedAt = await claimDispatchRound(campaignId, RESUME_COOLDOWN_MS);
  if (!dispatchedAt) return { outcome: "too_soon" };

  const queued = await channel.queue(dispatchKeyOf(dispatchedAt));
  if (queued.queued < queued.total) throw new QueueIncompleteError(queued);

  return { outcome: "resumed", pending: counts.pending, batches: queued.total };
}

/**
 * Make sure the current round of a sending campaign is fully queued.
 *
 * For the scheduled dispatch when QStash retries it after a partial publish:
 * by then the campaign is already "sending", so dispatchCampaign would do
 * nothing and the batches that never made it would be stranded. Reusing the
 * round's key means QStash drops every batch it already holds, so only the
 * missing ones go out. No quota is reserved; the first attempt did that.
 */
export async function ensureCampaignQueued(campaignId: string): Promise<QueueResult> {
  const campaign = await getCampaign(campaignId);
  if (!campaign || campaign.status !== "sending" || !campaign.lastDispatchedAt) {
    return { queued: 0, total: 0 };
  }
  const channel = await channelFor(campaign);
  const queued = await channel.queue(dispatchKeyOf(campaign.lastDispatchedAt));
  if (queued.queued < queued.total) throw new QueueIncompleteError(queued);
  return queued;
}

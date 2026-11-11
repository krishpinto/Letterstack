import { claimCampaignForSending, getCampaign } from "@/db/campaigns";
import { prepareCampaignAudience } from "@/db/campaign-recipients";
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
import { publishSesBatches, type FrozenContent } from "./send-campaign";
import { publishGmailRun } from "./gmail-campaign";

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

/** Who asked for the send. A schedule can only start a campaign still "scheduled". */
export type DispatchTrigger = "now" | "schedule";

export type DispatchResult =
  | { outcome: "started"; total: number; batches: number }
  /** Another request claimed the campaign first; this one did nothing. */
  | { outcome: "already_sending" };

type Campaign = NonNullable<Awaited<ReturnType<typeof getCampaign>>>;

/** One channel's quota and queueing, so the start sequence below is written once. */
type Channel = {
  reserve(count: number): Promise<void>;
  release(count: number): Promise<void>;
  publish(audienceIds: string[]): Promise<{ batches: number }>;
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
    publish: (ids) =>
      publishSesBatches({
        content,
        userId: campaign.userId,
        organizationId: campaign.organizationId,
        campaignId: campaign.id,
        recipientIds: ids,
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
    publish: (ids) =>
      publishGmailRun({
        content,
        userId: campaign.userId,
        organizationId: campaign.organizationId,
        mailboxId: mailbox.id,
        campaignId: campaign.id,
        recipientIds: ids,
      }),
  };
}

/**
 * Single entry point for "Send now" and the scheduled dispatch. Routes to
 * the SES or Gmail channel based on the campaign's own senderType, so
 * neither caller has to know or duplicate that branch.
 *
 * Order matters:
 *   1. read the audience and reserve quota for it,
 *   2. claim the campaign with one guarded UPDATE,
 *   3. only the winner publishes.
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

  const channel =
    campaign.senderType === "mailbox" ? await gmailChannel(campaign) : sesChannel(campaign);

  const audience = await prepareCampaignAudience(campaignId, campaign.organizationId);
  if (audience.length === 0) {
    throw new SendRefusedError("Add at least one recipient before sending");
  }

  await channel.reserve(audience.length);

  if (!(await claimCampaignForSending(campaignId, from))) {
    await channel.release(audience.length);
    return { outcome: "already_sending" };
  }

  // First send starts the free Pro countdown. After the first this is a
  // no-op: the guard lives in the statement.
  await startTrialClockOnFirstSend(campaign.organizationId);

  const { batches } = await channel.publish(audience.map((row) => row.id));

  // After the send is committed, never before: a notification for a send
  // that did not happen is worse than none. Awaited because a serverless
  // function can freeze the moment it returns; the call swallows its own
  // errors, so it cannot fail the send it reports.
  await notifyAdminsOfCampaignSend(campaignId);

  return { outcome: "started", total: audience.length, batches };
}

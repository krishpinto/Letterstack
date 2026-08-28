import { getCampaign, markCampaignSending } from "@/db/campaigns";
import { markCampaignRecipient, prepareCampaignAudience } from "@/db/campaign-recipients";
import { isSuppressedForOrganization } from "@/db/suppression";
import { getSendUsage, tryReserveSendQuota } from "@/db/organizations";
import {
  getMailbox,
  getMailboxSendUsage,
  releaseMailboxQuota,
  tryReserveMailboxQuota,
} from "@/db/connected-mailboxes";
import { getValidAccessToken, MailboxReauthRequiredError } from "./gmail-auth";
import { sendGmailMessage } from "./gmail";
import { appBaseUrl, publishQstashJSON } from "./qstash";
import {
  personalizeUnsubscribe,
  unsubscribeOneClickUrl,
  unsubscribePageUrl,
} from "@/lib/email/unsubscribe";
import type { FrozenContent } from "./send-campaign";

/**
 * Gmail's own send path — deliberately separate functions from
 * send-campaign.ts rather than a branch inside it. The two differ in kind,
 * not just configuration: an expired Gmail token has to halt the whole
 * batch (see MailboxReauthRequiredError below), where SES's per-recipient
 * catch-and-continue would instead mismark dozens of people "failed" for
 * what is really one problem. See the Gmail Sending plan for the full
 * reasoning.
 */

// Gmail's real constraint is roughly 1 message/second per account — a short
// gap between sends, not a batch size, since (unlike SES) there's no
// multi-message fan-out for a Gmail campaign at all; see startGmailCampaign.
const SEND_GAP_MS = 1100;
const RATE_LIMIT_BACKOFF_MS = 3000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("429") || message.toLowerCase().includes("rate limit");
}

type CampaignBatchRow = { id: string; email: string };

export type GmailBatchResult = {
  sent: number;
  failed: number;
  /** True if the run stopped early because the mailbox needs reconnecting. */
  haltedForReconnect: boolean;
};

export async function sendGmailCampaignBatch(
  content: FrozenContent,
  rows: CampaignBatchRow[],
  userId: string,
  organizationId: string,
  mailboxId: string,
): Promise<GmailBatchResult> {
  let sent = 0;
  let failed = 0;
  const base = appBaseUrl();

  const mailbox = await getMailbox(mailboxId);
  if (!mailbox) {
    // Shouldn't happen — startGmailCampaign already checked it exists — but
    // leaving everything pending is the safe failure mode either way.
    return { sent, failed, haltedForReconnect: false };
  }

  for (const row of rows) {
    try {
      if (await isSuppressedForOrganization(organizationId, row.email)) {
        await markCampaignRecipient(row.id, "failed", "suppressed");
        failed++;
        await sleep(SEND_GAP_MS);
        continue;
      }

      const personalized = personalizeUnsubscribe(
        content,
        unsubscribePageUrl(base, userId, row.email),
      );
      const sendOnce = async () => {
        const accessToken = await getValidAccessToken(mailbox);
        await sendGmailMessage(accessToken, {
          to: row.email,
          subject: content.subject,
          html: personalized.html,
          text: personalized.text,
          fromName: content.fromName,
          fromEmail: mailbox.email,
          replyTo: content.replyTo,
          listUnsubscribeUrl: unsubscribeOneClickUrl(base, userId, row.email),
        });
      };

      try {
        await sendOnce();
      } catch (err) {
        // Gmail's own rate limiter, not a rejected message — back off once
        // and retry within this invocation rather than failing the
        // recipient over a transient throttle.
        if (isRateLimitError(err)) {
          await sleep(RATE_LIMIT_BACKOFF_MS);
          await sendOnce();
        } else {
          throw err;
        }
      }

      await markCampaignRecipient(row.id, "sent");
      sent++;
    } catch (err) {
      if (err instanceof MailboxReauthRequiredError) {
        // Not a per-recipient failure — the whole mailbox is down. Stop
        // here and leave everything from this row onward `pending`, so a
        // "Resume" after reconnecting picks up exactly where this left off
        // instead of every remaining recipient reading as an individual
        // bounce.
        return { sent, failed, haltedForReconnect: true };
      }
      await markCampaignRecipient(
        row.id,
        "failed",
        err instanceof Error ? err.message : "Unknown error",
      );
      failed++;
    }
    await sleep(SEND_GAP_MS);
  }

  return { sent, failed, haltedForReconnect: false };
}

export async function startGmailCampaign(campaignId: string) {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.senderType !== "mailbox" || !campaign.mailboxId) {
    throw new Error("This campaign isn't set to send through a connected Gmail account");
  }

  const mailbox = await getMailbox(campaign.mailboxId);
  if (!mailbox || mailbox.organizationId !== campaign.organizationId) {
    throw new Error("The connected Gmail account for this campaign was not found");
  }
  if (mailbox.status !== "active") {
    throw new Error(
      mailbox.status === "revoked"
        ? "This Gmail account is no longer connected. Reconnect it or choose a different sender."
        : "This Gmail account needs to be reconnected before it can send.",
    );
  }

  const audience = await prepareCampaignAudience(campaignId, campaign.organizationId);
  if (audience.length === 0) {
    throw new Error("Add at least one recipient before sending");
  }

  // Two ceilings, both enforced: the mailbox's own daily cap (checked and
  // reserved first — cheaper to fail, no rollback needed) and the org's
  // monthly plan allowance (same as every other channel). Skipping the
  // second would let one connected mailbox send far more per month than
  // the org's plan actually allows — see the Gmail Sending plan's quota
  // section for the numbers behind why this matters.
  const mailboxReserved = await tryReserveMailboxQuota(mailbox.id, audience.length);
  if (!mailboxReserved) {
    const usage = await getMailboxSendUsage(mailbox.id);
    const remaining = Math.max(0, usage.limit - usage.used);
    throw new Error(
      `This send is ${audience.length.toLocaleString()} emails but your Gmail account can only send ` +
        `${remaining.toLocaleString()} more today (its own ${usage.limit.toLocaleString()}/day limit). ` +
        `Try a smaller list, or send the rest tomorrow.`,
    );
  }

  const orgReserved = await tryReserveSendQuota(campaign.organizationId, audience.length);
  if (!orgReserved) {
    await releaseMailboxQuota(mailbox.id, audience.length);
    const usage = await getSendUsage(campaign.organizationId);
    const remaining = Math.max(0, usage.limit - usage.used);
    throw new Error(
      `This send is ${audience.length.toLocaleString()} emails but only ${remaining.toLocaleString()} of your ${usage.limit.toLocaleString()} monthly emails are left. ` +
        `Upgrade in Settings → Billing, or send to a smaller group.`,
    );
  }

  await markCampaignSending(campaignId);

  const content: FrozenContent = {
    subject: campaign.subject,
    html: campaign.htmlSnapshot,
    text: campaign.textSnapshot,
    fromName: campaign.fromName,
    fromEmail: mailbox.email,
    replyTo: campaign.replyTo ?? undefined,
  };

  // No batch fan-out, one QStash message for the whole (already
  // quota-capped) audience — Gmail's real constraint is roughly 1/sec on
  // one account, and QStash gives no guarantee against two fanned-out
  // batches for the same mailbox running concurrently, which would defeat
  // the serial pacing entirely. One message, one worker invocation, a loop.
  await publishQstashJSON({
    url: `${appBaseUrl()}/api/send/gmail-campaign-worker`,
    body: {
      content,
      userId: campaign.userId,
      organizationId: campaign.organizationId,
      mailboxId: mailbox.id,
      campaignId,
      campaignRecipientIds: audience.map((row) => row.id),
    },
  });

  return { total: audience.length, batches: 1 };
}

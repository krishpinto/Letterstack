import {
  claimCampaignRecipient,
  finishCampaignRecipient,
  returnCampaignRecipientToPending,
} from "@/db/campaign-recipients";
import { isSuppressedForOrganization } from "@/db/suppression";
import { getMailbox } from "@/db/connected-mailboxes";
import { getValidAccessToken, MailboxReauthRequiredError } from "./gmail-auth";
import { sendGmailMessage } from "./gmail";
import { appBaseUrl, publishQstashJSON } from "./qstash";
import {
  personalizeUnsubscribe,
  unsubscribeOneClickUrl,
  unsubscribePageUrl,
} from "@/lib/email/unsubscribe";
import { recordSent, releaseClaimAndThrow, type FrozenContent } from "./send-campaign";

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
// multi-message fan-out for a Gmail campaign at all; see publishGmailRun.
const SEND_GAP_MS = 1100;
const RATE_LIMIT_BACKOFF_MS = 3000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("429") || message.toLowerCase().includes("rate limit");
}

export type GmailBatchResult = {
  sent: number;
  failed: number;
  unrecorded: number;
  /** True if the run stopped early because the mailbox needs reconnecting. */
  haltedForReconnect: boolean;
};

export async function sendGmailCampaignBatch(
  content: FrozenContent,
  recipientIds: string[],
  userId: string,
  organizationId: string,
  mailboxId: string,
): Promise<GmailBatchResult> {
  let sent = 0;
  let failed = 0;
  let unrecorded = 0;
  const base = appBaseUrl();

  const mailbox = await getMailbox(mailboxId);
  if (!mailbox) {
    // Shouldn't happen — dispatchCampaign already checked it exists — but
    // leaving everything pending is the safe failure mode either way.
    return { sent, failed, unrecorded, haltedForReconnect: false };
  }

  for (const id of recipientIds) {
    // Claimed one at a time, right before its own send — see
    // sendCampaignBatch. Matters more here: a Gmail run is long, and a
    // claim taken up front for all of it would strand every unsent row if
    // the function were killed.
    const row = await claimCampaignRecipient(id);
    if (!row) continue;

    let suppressed: boolean;
    try {
      suppressed = await isSuppressedForOrganization(organizationId, row.email);
    } catch (err) {
      return releaseClaimAndThrow(row.id, err);
    }
    if (suppressed) {
      await finishCampaignRecipient(row.id, "failed", "suppressed");
      failed++;
      continue;
    }

    try {
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
    } catch (err) {
      if (err instanceof MailboxReauthRequiredError) {
        // Not a per-recipient failure — the whole mailbox is down. Put this
        // row back and stop, leaving everything from here on "pending", so a
        // Resume after reconnecting picks up exactly where this left off
        // instead of every remaining recipient reading as a bounce.
        await returnCampaignRecipientToPending(row.id);
        return { sent, failed, unrecorded, haltedForReconnect: true };
      }
      await finishCampaignRecipient(
        row.id,
        "failed",
        err instanceof Error ? err.message : "Unknown error",
      );
      failed++;
      await sleep(SEND_GAP_MS);
      continue;
    }

    if (await recordSent(row.id)) sent++;
    else unrecorded++;
    await sleep(SEND_GAP_MS);
  }

  return { sent, failed, unrecorded, haltedForReconnect: false };
}

/**
 * Queue a Gmail campaign's audience as one QStash message. No batch fan-out:
 * Gmail's real constraint is roughly 1/sec on one account, and QStash gives
 * no guarantee against two fanned-out batches for the same mailbox running
 * concurrently, which would defeat the serial pacing entirely.
 */
export async function publishGmailRun(input: {
  content: FrozenContent;
  userId: string;
  organizationId: string;
  mailboxId: string;
  campaignId: string;
  recipientIds: string[];
}) {
  await publishQstashJSON({
    url: `${appBaseUrl()}/api/send/gmail-campaign-worker`,
    body: {
      content: input.content,
      userId: input.userId,
      organizationId: input.organizationId,
      mailboxId: input.mailboxId,
      campaignId: input.campaignId,
      campaignRecipientIds: input.recipientIds,
    },
  });
  return { batches: 1 };
}

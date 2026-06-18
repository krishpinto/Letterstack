import { compileEmailDocument } from "@/lib/email/compiler";
import type { EmailDocument } from "@/lib/email/document";
import { listUnsentRecipients, markRecipientSent } from "@/db/recipients";
import { isSuppressed } from "@/db/suppression";
import { getCampaign, markCampaignSending } from "@/db/campaigns";
import { freezeAudience, markCampaignRecipient } from "@/db/campaign-recipients";
import { sendEmail } from "./ses";
import { qstash, appBaseUrl } from "./qstash";

/**
 * The send engine, now backed by QStash.
 *
 *   runCampaign()  = the TRIGGER. Freezes the email, splits the list into
 *                    batches, and hands each batch to QStash. Returns at once.
 *   sendBatch()    = the WORKER logic. Sends ONE batch (with the checklist).
 *                    Called by the worker endpoint (app/api/send/worker) each
 *                    time QStash delivers a batch.
 */

// Real value will be 50 (SES allows 14 emails/sec). Tiny here so a few test
// addresses form several batches you can watch.
const BATCH_SIZE = 2;

/** The frozen email content every worker sends — same for the whole campaign. */
export type FrozenContent = {
  subject: string;
  html: string;
  text: string;
  fromName: string;
  fromEmail: string;
};

/** The minimal info the worker needs about each person in its batch. */
type BatchRecipient = { id: string; email: string };

/** What the trigger reports back: how much work it handed to QStash. */
export type CampaignQueueSummary = {
  totalUnsent: number;
  batches: number;
};

// ── WORKER LOGIC ──────────────────────────────────────────────────────────────
// Sends ONE batch. Called by the worker endpoint when QStash delivers a batch.
// Idempotent: stamps each person only after a successful send.
export async function sendBatch(
  content: FrozenContent,
  people: BatchRecipient[],
  userId: string,
) {
  let sent = 0;
  let failed = 0;
  let suppressed = 0;
  const failures: { email: string; error: string }[] = [];

  for (const person of people) {
    // Do-not-mail check: never send to a bounced/complained/unsubscribed address
    // on THIS owner's list.
    if (await isSuppressed(userId, person.email)) {
      suppressed++;
      continue;
    }

    try {
      await sendEmail({
        to: person.email,
        subject: content.subject,
        html: content.html,
        text: content.text,
        fromName: content.fromName,
        fromEmail: content.fromEmail,
      });
      await markRecipientSent(person.id); // tick off the checklist, after success
      sent++;
    } catch (err) {
      failed++;
      failures.push({
        email: person.email,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return { sent, failed, suppressed, failures };
}

// ── TRIGGER ─────────────────────────────────────────────────────────────────
// Freezes the email, splits unsent people into batches, and hands each batch to
// QStash as its own job. Returns as soon as everything is enqueued — the actual
// sending happens in the background as QStash calls the worker endpoint.
export async function runCampaign(
  doc: EmailDocument,
  userId: string,
): Promise<CampaignQueueSummary> {
  // Freeze the content once — the snapshot every worker sends.
  const { html, text } = compileEmailDocument(doc);
  const content: FrozenContent = {
    subject: doc.subject,
    html,
    text,
    fromName: doc.fromName,
    fromEmail: doc.fromEmail,
  };

  // Only THIS user's people not already emailed, split into batches.
  const people = await listUnsentRecipients(userId);
  const batches = chunk(people, BATCH_SIZE);

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  // Hand each batch to QStash. It will call our worker endpoint once per batch,
  // paced and retried. We send only the recipient IDs — the worker re-checks
  // the checklist itself, so a retried batch never double-sends.
  await Promise.all(
    batches.map((batch) =>
      qstash.publishJSON({
        url: `${appUrl}/api/send/worker`,
        body: { content, userId, recipientIds: batch.map((p) => p.id) },
      }),
    ),
  );

  return { totalUnsent: people.length, batches: batches.length };
}

// ── PER-CAMPAIGN FLOW (the real one — writes status into campaign_recipients) ──

type CampaignBatchRow = { id: string; email: string };

/**
 * WORKER LOGIC for a campaign batch. Sends each person and records their
 * outcome in campaign_recipients (sent / failed). Suppressed addresses are
 * recorded as failed (they shouldn't be here — freezeAudience excludes them —
 * but this catches anyone suppressed after the freeze).
 */
export async function sendCampaignBatch(
  content: FrozenContent,
  rows: CampaignBatchRow[],
  userId: string,
) {
  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    if (await isSuppressed(userId, row.email)) {
      await markCampaignRecipient(row.id, "failed", "suppressed");
      failed++;
      continue;
    }
    try {
      await sendEmail({
        to: row.email,
        subject: content.subject,
        html: content.html,
        text: content.text,
        fromName: content.fromName,
        fromEmail: content.fromEmail,
      });
      await markCampaignRecipient(row.id, "sent");
      sent++;
    } catch (err) {
      await markCampaignRecipient(row.id, "failed", err instanceof Error ? err.message : "Unknown error");
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * TRIGGER for a campaign. Freezes the audience, flips the campaign to "sending",
 * then hands each batch of campaign_recipients to QStash. Returns immediately.
 */
export async function startCampaign(campaignId: string) {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error("Campaign not found");

  // Freeze WHO it goes to: the campaign owner's non-suppressed contacts.
  const audience = await freezeAudience(campaignId, campaign.userId);
  await markCampaignSending(campaignId);

  const content: FrozenContent = {
    subject: campaign.subject,
    html: campaign.htmlSnapshot,
    text: campaign.textSnapshot,
    fromName: campaign.fromName,
    fromEmail: campaign.fromEmail,
  };

  const appUrl = appBaseUrl();
  const batches = chunk(audience, BATCH_SIZE);

  await Promise.all(
    batches.map((batch) =>
      qstash.publishJSON({
        url: `${appUrl}/api/send/campaign-worker`,
        body: { content, userId: campaign.userId, campaignRecipientIds: batch.map((r) => r.id) },
      }),
    ),
  );

  return { total: audience.length, batches: batches.length };
}

// ── tiny helper ───────────────────────────────────────────────────────────────

/** Split an array into chunks of `size`: [1,2,3,4,5] → [[1,2],[3,4],[5]]. */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

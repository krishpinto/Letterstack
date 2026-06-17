import { compileEmailDocument } from "@/lib/email/compiler";
import type { EmailDocument } from "@/lib/email/document";
import { listUnsentRecipients, markRecipientSent } from "@/db/recipients";
import { isSuppressed } from "@/db/suppression";
import { sendEmail } from "./ses";
import { qstash } from "./qstash";

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
export async function sendBatch(content: FrozenContent, people: BatchRecipient[]) {
  let sent = 0;
  let failed = 0;
  let suppressed = 0;
  const failures: { email: string; error: string }[] = [];

  for (const person of people) {
    // Do-not-mail check: never send to a bounced/complained/unsubscribed address.
    if (await isSuppressed(person.email)) {
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
export async function runCampaign(doc: EmailDocument): Promise<CampaignQueueSummary> {
  // Freeze the content once — the snapshot every worker sends.
  const { html, text } = compileEmailDocument(doc);
  const content: FrozenContent = {
    subject: doc.subject,
    html,
    text,
    fromName: doc.fromName,
    fromEmail: doc.fromEmail,
  };

  // Only people not already emailed, split into batches.
  const people = await listUnsentRecipients();
  const batches = chunk(people, BATCH_SIZE);

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  // Hand each batch to QStash. It will call our worker endpoint once per batch,
  // paced and retried. We send only the recipient IDs — the worker re-checks
  // the checklist itself, so a retried batch never double-sends.
  await Promise.all(
    batches.map((batch) =>
      qstash.publishJSON({
        url: `${appUrl}/api/send/worker`,
        body: { content, recipientIds: batch.map((p) => p.id) },
      }),
    ),
  );

  return { totalUnsent: people.length, batches: batches.length };
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

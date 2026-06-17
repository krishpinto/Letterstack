import { compileEmailDocument } from "@/lib/email/compiler";
import type { EmailDocument } from "@/lib/email/document";
import { listUnsentRecipients, markRecipientSent } from "@/db/recipients";
import { sendEmail } from "./ses";

/**
 * The send engine, in the "trigger → batches → worker" shape.
 *
 *   runCampaign()  = the TRIGGER. Freezes the email, splits the list into
 *                    batches, and dispatches each batch.
 *   sendBatch()    = the WORKER. Sends ONE batch (with the sent-checklist).
 *   the for-loop   = a STAND-IN for QStash. In Step 2 we replace it with real
 *                    QStash, but sendBatch() won't change at all.
 */

// Real value will be 50 (SES allows 14 emails/sec). Tiny here so that a few
// test addresses form several batches you can actually watch happen.
const BATCH_SIZE = 2;

/** The frozen email content every worker sends — same for the whole campaign. */
type FrozenContent = {
  subject: string;
  html: string;
  text: string;
  fromName: string;
  fromEmail: string;
};

/** The minimal info the worker needs about each person in its batch. */
type BatchRecipient = { id: string; email: string };

export type CampaignSummary = {
  totalUnsent: number;
  batches: number;
  sent: number;
  failed: number;
  failures: { email: string; error: string }[];
};

// ── WORKER ──────────────────────────────────────────────────────────────────
// Sends ONE batch. This is the piece that later becomes the worker endpoint.
// It's idempotent: it stamps each person only after a successful send, so a
// retry of this same batch skips anyone already done.
export async function sendBatch(content: FrozenContent, people: BatchRecipient[]) {
  let sent = 0;
  let failed = 0;
  const failures: { email: string; error: string }[] = [];

  for (const person of people) {
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

  return { sent, failed, failures };
}

// ── TRIGGER ─────────────────────────────────────────────────────────────────
// Freezes the email, splits unsent people into batches, dispatches each batch.
export async function runCampaign(doc: EmailDocument): Promise<CampaignSummary> {
  // Freeze the content once — this is the snapshot every worker sends.
  const { html, text } = compileEmailDocument(doc);
  const content: FrozenContent = {
    subject: doc.subject,
    html,
    text,
    fromName: doc.fromName,
    fromEmail: doc.fromEmail,
  };

  // Only people not already emailed, split into batches of BATCH_SIZE.
  const people = await listUnsentRecipients();
  const batches = chunk(people, BATCH_SIZE);

  const summary: CampaignSummary = {
    totalUnsent: people.length,
    batches: batches.length,
    sent: 0,
    failed: 0,
    failures: [],
  };

  // ⬇⬇⬇ THIS LOOP IS THE STAND-IN FOR QSTASH ⬇⬇⬇
  // In Step 2, instead of calling sendBatch() directly here, we hand each batch
  // to QStash and QStash calls the worker endpoint. The worker (sendBatch) is
  // identical either way — only this dispatch step changes.
  for (let i = 0; i < batches.length; i++) {
    const result = await sendBatch(content, batches[i]);
    summary.sent += result.sent;
    summary.failed += result.failed;
    summary.failures.push(...result.failures);

    // Pace the batches out. Real spacing is ~4s (derived from SES's 14/sec);
    // short here just so you can see batches happen one after another.
    if (i < batches.length - 1) await sleep(800);
  }
  // ⬆⬆⬆ QStash will own this dispatch+pacing+retry later ⬆⬆⬆

  return summary;
}

// ── tiny helpers ──────────────────────────────────────────────────────────────

/** Split an array into chunks of `size`: [1,2,3,4,5] → [[1,2],[3,4],[5]]. */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

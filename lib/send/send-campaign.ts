import { compileEmailDocument } from "@/lib/email/compiler";
import type { EmailDocument } from "@/lib/email/document";
import { listRecipients } from "@/db/recipients";
import { sendEmail } from "./ses";

/**
 * Send one newsletter to everyone in the `recipients` table — "fan-out".
 *
 * This is the simple teaching version: a plain loop, one email at a time.
 * Later we'll make it batched + retry-safe (QStash) and skip people already
 * sent to, but the heart stays the same: compile once, read the list, send each.
 */

export type SendSummary = {
  total: number;
  sent: number;
  failed: number;
  failures: { email: string; error: string }[];
};

export async function sendCampaignToAll(doc: EmailDocument): Promise<SendSummary> {
  // Compile ONCE — the same HTML/text is sent to every recipient.
  const { html, text } = compileEmailDocument(doc);

  // Read the list of people from the database.
  const people = await listRecipients();

  const summary: SendSummary = {
    total: people.length,
    sent: 0,
    failed: 0,
    failures: [],
  };

  // The simplest fan-out: hand each person's email to the courier in turn.
  for (const person of people) {
    try {
      await sendEmail({
        to: person.email,
        subject: doc.subject,
        html,
        text,
        fromName: doc.fromName,
        fromEmail: doc.fromEmail,
      });
      summary.sent++;
    } catch (err) {
      // One bad address shouldn't stop the whole send — record it and continue.
      summary.failed++;
      summary.failures.push({
        email: person.email,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return summary;
}

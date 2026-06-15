/**
 * Step 1 — prove the SES transport end to end, with no DB and no queue.
 *
 * Compiles a real EmailDocument with the editor's compiler, then hands the
 * resulting HTML/text to SES. If this email lands in your inbox, the hardest
 * unknown (SES + domain + credentials) is solved and everything else is plumbing.
 *
 * Run:  npm run send:test
 */
import { compileEmailDocument } from "../lib/email/compiler";
import { initialEmailDocument } from "../lib/email/document";
import { sendEmail } from "../lib/send/ses";

async function main() {
  const to = process.env.TEST_TO;
  const fromEmail = process.env.MAIL_FROM;

  if (!to || !fromEmail) {
    throw new Error(
      "Missing env. Set TEST_TO and MAIL_FROM in .env.local (and AWS_* keys).",
    );
  }

  // Start from the editor's default doc; override the send fields.
  const doc = {
    ...initialEmailDocument,
    subject: "LetterStack — first real send ✔",
    fromName: "LetterStack",
    fromEmail,
  };

  const { html, text } = compileEmailDocument(doc);

  console.log(`→ Sending to ${to} from ${fromEmail} (region ${process.env.AWS_REGION}) ...`);
  const messageId = await sendEmail({
    to,
    subject: doc.subject,
    html,
    text,
    fromName: doc.fromName,
    fromEmail: doc.fromEmail,
  });
  console.log(`✔ Accepted by SES. MessageId: ${messageId}`);
  console.log("  Check your inbox (and spam) — delivery is usually seconds.");
}

main().catch((err) => {
  console.error("Failed to send:\n", err);
  process.exit(1);
});

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

/**
 * Amazon SES transport — the single point that hands one email to AWS.
 *
 * Credentials + region come from the environment (AWS_REGION,
 * AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) via the SDK's default credential
 * chain — never hard-code keys. Everything else in the send path (batching,
 * idempotency, retries, webhooks) wraps around this one call.
 */

// Created lazily so the region is read from env at first send, not at import
// time — keeps us robust to whatever order env vars get loaded.
let client: SESv2Client | null = null;
function sesClient(): SESv2Client {
  if (!client) client = new SESv2Client({ region: process.env.AWS_REGION });
  return client;
}

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName: string;
  /** Must be an address on a domain verified in this SES region. */
  fromEmail: string;
  /** Where replies land (e.g. the visitor behind a contact-form message). */
  replyTo?: string;
  listUnsubscribeUrl?: string;
  tags?: { name: string; value: string }[];
};

/** Sends one email through SES. Returns the SES MessageId on success. */
export async function sendEmail(input: SendEmailInput): Promise<string> {
  const command = new SendEmailCommand({
    FromEmailAddress: `${input.fromName} <${input.fromEmail}>`,
    Destination: { ToAddresses: [input.to] },
    ReplyToAddresses: input.replyTo ? [input.replyTo] : undefined,
    ConfigurationSetName: process.env.SES_CONFIGURATION_SET,
    Content: {
      Simple: {
        Subject: { Data: input.subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: input.html, Charset: "UTF-8" },
          Text: { Data: input.text, Charset: "UTF-8" },
        },
        Headers: input.listUnsubscribeUrl
          ? [
              { Name: "List-Unsubscribe", Value: `<${input.listUnsubscribeUrl}>` },
              { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
            ]
          : undefined,
      },
    },
    EmailTags: input.tags?.map((tag) => ({
      Name: tag.name,
      Value: tag.value,
    })),
  });

  const result = await sesClient().send(command);
  return result.MessageId ?? "";
}

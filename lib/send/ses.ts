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
};

/** Sends one email through SES. Returns the SES MessageId on success. */
export async function sendEmail(input: SendEmailInput): Promise<string> {
  const command = new SendEmailCommand({
    FromEmailAddress: `${input.fromName} <${input.fromEmail}>`,
    Destination: { ToAddresses: [input.to] },
    // Routes this send through the SES configuration set, which is what emits
    // delivery/bounce/complaint/open/click events into SNS → our webhook. When
    // unset (e.g. a quick local test), SES just sends with no event tracking.
    ConfigurationSetName: process.env.SES_CONFIGURATION_SET,
    Content: {
      Simple: {
        Subject: { Data: input.subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: input.html, Charset: "UTF-8" },
          Text: { Data: input.text, Charset: "UTF-8" },
        },
      },
    },
  });

  const result = await sesClient().send(command);
  return result.MessageId ?? "";
}

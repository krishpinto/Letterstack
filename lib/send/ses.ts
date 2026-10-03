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
  /**
   * Where replies land (e.g. the visitor behind a contact-form message). A
   * list is allowed: billing mail goes to everyone who handles billing.
   */
  replyTo?: string | string[];
  listUnsubscribeUrl?: string;
  tags?: { name: string; value: string }[];
};

/**
 * Reply-To as SES wants it, or undefined.
 *
 * An empty list has to collapse to undefined rather than an empty header: the
 * addresses are configuration, and an unconfigured deployment should send no
 * Reply-To at all instead of a malformed one.
 */
function replyToList(value: string | string[] | undefined): string[] | undefined {
  if (!value) return undefined;
  const list = Array.isArray(value) ? value : [value];
  const clean = list.map((entry) => entry.trim()).filter(Boolean);
  return clean.length > 0 ? clean : undefined;
}

/** Sends one email through SES. Returns the SES MessageId on success. */
export async function sendEmail(input: SendEmailInput): Promise<string> {
  const command = new SendEmailCommand({
    FromEmailAddress: `${input.fromName} <${input.fromEmail}>`,
    Destination: { ToAddresses: [input.to] },
    ReplyToAddresses: replyToList(input.replyTo),
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

export type EmailAttachment = {
  filename: string;
  /** Raw bytes. Base64-encoded into the MIME part here, not by the caller. */
  content: Buffer;
  contentType: string;
};

/** Folds a base64 string to the 76-character lines MIME requires. */
function foldBase64(value: string): string {
  return value.replace(/(.{76})/g, "$1\r\n");
}

/** RFC 2047 encoded-word, so non-ASCII subjects survive every mail client. */
function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/**
 * Sends one email with file attachments.
 *
 * SESv2's `Simple` content has no attachment field at all, so anything carrying
 * a file has to be handed over as a raw MIME message that we assemble
 * ourselves. Kept separate from sendEmail rather than folded into it: the
 * simple path is what every campaign send uses, and it should not grow a MIME
 * builder it never exercises.
 *
 * Structure is multipart/mixed wrapping a multipart/alternative (text + HTML)
 * plus one part per attachment — the arrangement mail clients handle most
 * predictably. Bodies are base64 so a rupee sign or an em dash can't be
 * mangled by a transfer-encoding guess somewhere along the way.
 */
export async function sendEmailWithAttachments(
  input: SendEmailInput & { attachments: EmailAttachment[] },
): Promise<string> {
  const mixed = `mixed_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  const alt = `alt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;

  const lines: string[] = [
    `From: ${encodeHeader(input.fromName)} <${input.fromEmail}>`,
    `To: ${input.to}`,
    ...(replyToList(input.replyTo)
      ? [`Reply-To: ${replyToList(input.replyTo)!.join(", ")}`]
      : []),
    `Subject: ${encodeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixed}"`,
    "",
    `--${mixed}`,
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    "",
    `--${alt}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    foldBase64(Buffer.from(input.text, "utf8").toString("base64")),
    "",
    `--${alt}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    foldBase64(Buffer.from(input.html, "utf8").toString("base64")),
    "",
    `--${alt}--`,
    "",
  ];

  for (const attachment of input.attachments) {
    lines.push(
      `--${mixed}`,
      `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      "Content-Transfer-Encoding: base64",
      "",
      foldBase64(attachment.content.toString("base64")),
      "",
    );
  }

  lines.push(`--${mixed}--`, "");

  const command = new SendEmailCommand({
    FromEmailAddress: `${input.fromName} <${input.fromEmail}>`,
    Destination: { ToAddresses: [input.to] },
    ConfigurationSetName: process.env.SES_CONFIGURATION_SET,
    Content: { Raw: { Data: Buffer.from(lines.join("\r\n"), "utf8") } },
    EmailTags: input.tags?.map((tag) => ({ Name: tag.name, Value: tag.value })),
  });

  const result = await sesClient().send(command);
  return result.MessageId ?? "";
}

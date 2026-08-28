import { google } from "googleapis";

/**
 * Gmail API transport — the single point that hands one email to Gmail,
 * mirroring lib/send/ses.ts's role for SES. Sends as the connected
 * account itself (no arbitrary From, unlike SES) via
 * gmail.users.messages.send, which takes a raw base64url-encoded RFC 2822
 * message rather than SES's structured Content shape.
 */

export type SendGmailMessageInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  listUnsubscribeUrl?: string;
};

function encodeHeaderWord(value: string): string {
  // RFC 2047 encoded-word, for subject/display-name values that may contain
  // non-ASCII — plain ASCII values pass through unchanged (Buffer.from is a
  // no-op cost either way, and this avoids a separate ASCII-detection pass).
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function buildRawMessage(input: SendGmailMessageInput): string {
  const boundary = `ltrstk_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const headers = [
    `From: ${encodeHeaderWord(input.fromName)} <${input.fromEmail}>`,
    `To: ${input.to}`,
    `Subject: ${encodeHeaderWord(input.subject)}`,
    `MIME-Version: 1.0`,
    input.replyTo ? `Reply-To: ${input.replyTo}` : null,
    input.listUnsubscribeUrl ? `List-Unsubscribe: <${input.listUnsubscribeUrl}>` : null,
    input.listUnsubscribeUrl ? `List-Unsubscribe-Post: List-Unsubscribe=One-Click` : null,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter((line): line is string => line !== null);

  const body = [
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    input.text,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    ``,
    input.html,
    ``,
    `--${boundary}--`,
  ].join("\r\n");

  const message = `${headers.join("\r\n")}\r\n\r\n${body}`;
  return Buffer.from(message, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Sends one email through the Gmail API, authenticated as `accessToken`'s account. */
export async function sendGmailMessage(
  accessToken: string,
  input: SendGmailMessageInput,
): Promise<string> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth });

  const { data } = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: buildRawMessage(input) },
  });

  return data.id ?? "";
}

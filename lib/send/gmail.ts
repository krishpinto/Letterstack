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

// One RFC 2047 encoded-word may be at most 75 characters. 45 bytes of
// UTF-8 is 60 base64 characters, plus 12 for "=?UTF-8?B?" and "?=".
const ENCODED_WORD_MAX_BYTES = 45;

const PRINTABLE_ASCII = /^[\x20-\x7E]*$/;

/**
 * A header value safe to put on the wire: unchanged when it is printable
 * ASCII, otherwise RFC 2047 encoded-words, folded onto continuation lines.
 *
 * Long values are split into several words, each cut on a code point
 * boundary so no character is split across two words; decoders join
 * adjacent encoded-words back together. Control characters force encoding,
 * which also keeps a stray CR or LF in a subject from starting a new header.
 */
export function encodeHeaderValue(value: string): string {
  if (PRINTABLE_ASCII.test(value)) return value;

  const words: string[] = [];
  let current = "";
  for (const char of value) {
    if (current && Buffer.byteLength(current + char, "utf8") > ENCODED_WORD_MAX_BYTES) {
      words.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  if (current) words.push(current);

  return words
    .map((word) => `=?UTF-8?B?${Buffer.from(word, "utf8").toString("base64")}?=`)
    .join("\r\n ");
}

/** A display name for From: quoted when ASCII, encoded otherwise. */
function encodeDisplayName(name: string): string {
  if (PRINTABLE_ASCII.test(name)) return `"${name.replace(/["\\]/g, "\\$&")}"`;
  return encodeHeaderValue(name);
}

/** Base64 for a MIME body part, folded to the 76-character lines MIME requires. */
function base64Body(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/(.{76})/g, "$1\r\n");
}

/**
 * The RFC 2822 message Gmail's messages.send takes, before its base64url
 * wrapping. Exported for tests.
 *
 * Both body parts are base64 with charset=UTF-8. They used to be declared
 * 7bit, which promises pure ASCII in lines of at most 998 characters; any
 * accented letter, emoji or rupee sign broke that promise, and a long
 * single-line HTML snapshot broke the line limit, so servers along the way
 * were free to mangle both.
 */
export function buildMimeMessage(input: SendGmailMessageInput, boundary: string): string {
  const headers = [
    `From: ${encodeDisplayName(input.fromName)} <${input.fromEmail}>`,
    `To: ${input.to}`,
    `Subject: ${encodeHeaderValue(input.subject)}`,
    `MIME-Version: 1.0`,
    input.replyTo ? `Reply-To: ${input.replyTo}` : null,
    input.listUnsubscribeUrl ? `List-Unsubscribe: <${input.listUnsubscribeUrl}>` : null,
    input.listUnsubscribeUrl ? `List-Unsubscribe-Post: List-Unsubscribe=One-Click` : null,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter((line): line is string => line !== null);

  const body = [
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    base64Body(input.text),
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    base64Body(input.html),
    ``,
    `--${boundary}--`,
  ].join("\r\n");

  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}

function buildRawMessage(input: SendGmailMessageInput): string {
  const boundary = `ltrstk_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return Buffer.from(buildMimeMessage(input, boundary), "utf8")
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

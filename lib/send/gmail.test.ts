import { describe, expect, it, vi } from "vitest";

vi.mock("googleapis", () => ({ google: {} }));

import { buildMimeMessage, encodeHeaderValue } from "./gmail";

/** Decode a header back the way a mail client would. */
function decodeHeader(value: string): string {
  return value
    .split("\r\n ")
    .map((word) => {
      const match = /^=\?UTF-8\?B\?(.*)\?=$/.exec(word);
      return match ? Buffer.from(match[1], "base64").toString("utf8") : word;
    })
    .join("");
}

/** The decoded body of the part with this content type. */
function part(message: string, type: string): string {
  const start = message.indexOf(`Content-Type: ${type}`);
  const body = message.slice(start).split("\r\n\r\n")[1].split("\r\n\r\n--")[0];
  return Buffer.from(body.replace(/\r\n/g, ""), "base64").toString("utf8");
}

const input = {
  to: "reader@x.test",
  subject: "Diwali sale — ₹500 off 🎉",
  html: `<p>${"Namasté ₹ ".repeat(200)}</p>`,
  text: "Namasté ₹500",
  fromName: "Café Ünïcode",
  fromEmail: "me@gmail.test",
};

describe("encodeHeaderValue", () => {
  it("leaves plain ASCII alone", () => {
    expect(encodeHeaderValue("Weekly update")).toBe("Weekly update");
  });

  it("encodes UTF-8 and round-trips", () => {
    expect(decodeHeader(encodeHeaderValue(input.subject))).toBe(input.subject);
  });

  it("keeps every encoded-word within 75 characters on a long subject", () => {
    const subject = "शुभ दीपावली ".repeat(20);
    const encoded = encodeHeaderValue(subject);

    for (const word of encoded.split("\r\n ")) expect(word.length).toBeLessThanOrEqual(75);
    expect(decodeHeader(encoded)).toBe(subject);
  });

  it("encodes a value with a line break instead of letting it start a header", () => {
    const encoded = encodeHeaderValue("Hi\r\nBcc: someone@x.test");

    expect(encoded).not.toContain("\r\nBcc");
    expect(decodeHeader(encoded)).toBe("Hi\r\nBcc: someone@x.test");
  });
});

describe("buildMimeMessage", () => {
  const message = buildMimeMessage(input, "b1");

  it("declares base64 UTF-8 parts, never 7bit", () => {
    expect(message).not.toContain("7bit");
    expect(message.match(/Content-Transfer-Encoding: base64/g)).toHaveLength(2);
    expect(message.match(/charset="UTF-8"/g)).toHaveLength(2);
  });

  it("round-trips both bodies", () => {
    expect(part(message, "text/plain")).toBe(input.text);
    expect(part(message, "text/html")).toBe(input.html);
  });

  it("keeps every line within MIME's limits", () => {
    for (const line of message.split("\r\n")) expect(line.length).toBeLessThanOrEqual(998);
  });

  it("encodes a non-ASCII display name and quotes an ASCII one", () => {
    expect(message).toMatch(/^From: =\?UTF-8\?B\?/);
    expect(buildMimeMessage({ ...input, fromName: 'Acme, "Inc"' }, "b1")).toContain(
      'From: "Acme, \\"Inc\\"" <me@gmail.test>',
    );
  });
});

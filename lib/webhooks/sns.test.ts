import { createSign, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  isAllowedTopic,
  isValidSigningCertUrl,
  isValidSubscribeUrl,
  parseSnsEnvelope,
  parseTopicAllowList,
  publicKeyFromCertificate,
  snsStringToSign,
  verifySnsMessage,
  verifySnsSignature,
  type SnsMessage,
} from "./sns";

// A throwaway self-signed certificate (CN=sns-test.invalid, valid until
// 2126). Only the certificate is here; its private key was never kept.
const TEST_CERT = `-----BEGIN CERTIFICATE-----
MIIDGTCCAgGgAwIBAgIUCfKl239FOIlcM5a8cv1jS+RIqvgwDQYJKoZIhvcNAQEL
BQAwGzEZMBcGA1UEAwwQc25zLXRlc3QuaW52YWxpZDAgFw0yNjExMTEwMzUwMTRa
GA8yMTI2MTAxODAzNTAxNFowGzEZMBcGA1UEAwwQc25zLXRlc3QuaW52YWxpZDCC
ASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALRhj4gt+uJ6FCKxVmA/6+5o
1FgJaQfHaXzCQUHKwhuGaZb0ClT86izunWFvV6w0t0FwQaFIvcT+mJ8eAL4n73qX
2AsvIPn2lQm/C0g+Vu74edpdNo4vypnLmZZI2N6hBtqr95uLnA6lg/W/Y0BAYasH
AKxHphQjzaW6Guf5mFa8LoWnqgYGIyCsQRo+/tDV1JIfjatWFw0K7r/5sju/8ELU
y8295pw8k2xNoxxr6rr8vDHaG+4VH0LpuixOclSO9wceLT14th7mtg5iqJ57b2mM
x0A9ftUNJWFEKLH0+ScMRok4Z9y4mlKoBFQu1BWAqMmnug+e/u1XeK57HfnyU78C
AwEAAaNTMFEwHQYDVR0OBBYEFCx8NLvQVlZd9sTs5t3C+yjHqHaOMB8GA1UdIwQY
MBaAFCx8NLvQVlZd9sTs5t3C+yjHqHaOMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZI
hvcNAQELBQADggEBALEdwR20QVLPr4a6vbf87hXwGqge/QDPReZ+nUslJgaZZ+SX
8IydBlJJCFfX8vdcci9A7oSXj6EsObdSDtp3rSgvYqLwd14hFDwOBDZeZOV2hszh
3dELnviMxTw1F2wAgld8/VP6lAMUvq9F0rPGq35vfDpkco9PyWE1N+JckJvAtx4Q
l6DpaEFExUZ5FFuErSa61wCQgM75Uxf0pL8PL0qZtv3jSrIfmCO+7u72vgFK0RGu
LScrgMMem7WEROHuhmeAZ8bIjjwSyLPK3DB08Z2ERAPY+3gnVIchMy2/D+ekpKb4
fCwLrUh1LZicAyozfxAWV1DsExQYX9z92U1p/S0=
-----END CERTIFICATE-----`;

// Generated per run, so no private key is ever committed.
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const other = generateKeyPairSync("rsa", { modulusLength: 2048 });

const CERT_URL =
  "https://sns.ap-south-1.amazonaws.com/SimpleNotificationService-0123456789abcdef.pem";
const TOPIC = "arn:aws:sns:ap-south-1:123456789012:letterstack-ses-events";
const MESSAGE_ID = "22b80b92-fdea-4c2c-8f9d-bdfb0c7bf324";
const SUBSCRIBE_URL =
  "https://sns.ap-south-1.amazonaws.com/?Action=ConfirmSubscription&TopicArn=x&Token=abc";

function notification(overrides: Partial<SnsMessage> = {}): SnsMessage {
  return {
    Type: "Notification",
    MessageId: MESSAGE_ID,
    TopicArn: TOPIC,
    Message: '{"eventType":"Bounce"}',
    Timestamp: "2026-11-11T10:00:00.000Z",
    SignatureVersion: "2",
    Signature: "",
    SigningCertURL: CERT_URL,
    ...overrides,
  };
}

function confirmation(overrides: Partial<SnsMessage> = {}): SnsMessage {
  return notification({
    Type: "SubscriptionConfirmation",
    Message: "You have chosen to subscribe to the topic.",
    SubscribeURL: SUBSCRIBE_URL,
    Token: "abc",
    ...overrides,
  });
}

/** Signs the way SNS does, with the local private key. */
function sign(message: SnsMessage, key = privateKey): SnsMessage {
  const algorithm = message.SignatureVersion === "1" ? "RSA-SHA1" : "RSA-SHA256";
  const signer = createSign(algorithm);
  signer.update(snsStringToSign(message)!, "utf8");
  return { ...message, Signature: signer.sign(key, "base64") };
}

describe("snsStringToSign", () => {
  it("lists a notification's keys in AWS's order, without Subject when absent", () => {
    expect(snsStringToSign(notification())).toBe(
      'Message\n{"eventType":"Bounce"}\n' +
        `MessageId\n${MESSAGE_ID}\n` +
        "Timestamp\n2026-11-11T10:00:00.000Z\n" +
        `TopicArn\n${TOPIC}\n` +
        "Type\nNotification\n",
    );
  });

  it("puts Subject between MessageId and Timestamp when present", () => {
    const text = snsStringToSign(notification({ Subject: "Amazon SES Email Event" }));
    expect(text).toContain(
      `MessageId\n${MESSAGE_ID}\nSubject\nAmazon SES Email Event\nTimestamp\n`,
    );
  });

  it("signs SubscribeURL and Token for confirmations, and never Subject", () => {
    expect(snsStringToSign(confirmation({ Subject: "ignored" }))).toBe(
      "Message\nYou have chosen to subscribe to the topic.\n" +
        `MessageId\n${MESSAGE_ID}\n` +
        `SubscribeURL\n${SUBSCRIBE_URL}\n` +
        "Timestamp\n2026-11-11T10:00:00.000Z\n" +
        "Token\nabc\n" +
        `TopicArn\n${TOPIC}\n` +
        "Type\nSubscriptionConfirmation\n",
    );
  });

  it("uses the confirmation layout for UnsubscribeConfirmation too", () => {
    expect(snsStringToSign(confirmation({ Type: "UnsubscribeConfirmation" }))).toContain(
      "Token\nabc\n",
    );
  });

  it("refuses a confirmation missing a key it must sign", () => {
    expect(snsStringToSign(confirmation({ Token: undefined }))).toBeNull();
    expect(snsStringToSign(confirmation({ SubscribeURL: undefined }))).toBeNull();
  });
});

describe("verifySnsSignature", () => {
  it("accepts SignatureVersion 2 (SHA256) and 1 (SHA1) from the matching key", () => {
    expect(verifySnsSignature(sign(notification()), publicKey)).toBe(true);
    expect(verifySnsSignature(sign(notification({ SignatureVersion: "1" })), publicKey)).toBe(
      true,
    );
    expect(verifySnsSignature(sign(confirmation()), publicKey)).toBe(true);
  });

  it("rejects a signature from another key", () => {
    expect(verifySnsSignature(sign(notification(), other.privateKey), publicKey)).toBe(false);
  });

  it("rejects any change to a signed field", () => {
    const signed = sign(notification());
    const complaint = { ...signed, Message: '{"eventType":"Complaint"}' };
    expect(verifySnsSignature(complaint, publicKey)).toBe(false);
    expect(verifySnsSignature({ ...signed, TopicArn: `${TOPIC}-other` }, publicKey)).toBe(false);
    expect(verifySnsSignature({ ...signed, Subject: "added" }, publicKey)).toBe(false);
  });

  it("rejects a v1 signature relabelled as v2, unknown versions, and garbage", () => {
    const v1 = sign(notification({ SignatureVersion: "1" }));
    expect(verifySnsSignature({ ...v1, SignatureVersion: "2" }, publicKey)).toBe(false);
    const v3 = { ...sign(notification()), SignatureVersion: "3" };
    expect(verifySnsSignature(v3, publicKey)).toBe(false);
    expect(verifySnsSignature(notification({ Signature: "not base64!" }), publicKey)).toBe(false);
  });
});

describe("verifySnsMessage", () => {
  it("verifies with the key the loader returns for the cert URL", async () => {
    const urls: string[] = [];
    const result = await verifySnsMessage(sign(notification()), async (url) => {
      urls.push(url);
      return publicKey;
    });
    expect(result).toEqual({ ok: true });
    expect(urls).toEqual([CERT_URL]);
  });

  it("never loads a certificate from a non-SNS URL", async () => {
    let loaded = false;
    const forged = sign(notification({ SigningCertURL: "https://attacker.example/cert.pem" }));
    const result = await verifySnsMessage(forged, async () => {
      loaded = true;
      return publicKey;
    });
    expect(result.ok).toBe(false);
    expect(loaded).toBe(false);
  });

  it("fails closed when the certificate can't be loaded", async () => {
    const result = await verifySnsMessage(sign(notification()), async () => {
      throw new Error("timeout");
    });
    expect(result.ok).toBe(false);
  });
});

describe("certificate and subscribe URL checks", () => {
  it("accepts SNS certificate URLs, including China regions", () => {
    expect(isValidSigningCertUrl(CERT_URL)).toBe(true);
    expect(
      isValidSigningCertUrl(
        "https://sns.cn-north-1.amazonaws.com.cn/SimpleNotificationService-a.pem",
      ),
    ).toBe(true);
  });

  it.each([
    ["plain http", "http://sns.ap-south-1.amazonaws.com/cert.pem"],
    ["a lookalike suffix", "https://sns.ap-south-1.amazonaws.com.evil.example/cert.pem"],
    ["a prefixed host", "https://evilsns.ap-south-1.amazonaws.com/cert.pem"],
    ["another AWS service", "https://s3.ap-south-1.amazonaws.com/cert.pem"],
    ["credentials in the URL", "https://user@sns.ap-south-1.amazonaws.com/cert.pem"],
    ["a non-default port", "https://sns.ap-south-1.amazonaws.com:8443/cert.pem"],
    ["a non-pem path", "https://sns.ap-south-1.amazonaws.com/cert.txt"],
    ["a query string", "https://sns.ap-south-1.amazonaws.com/cert.pem?x=1"],
    ["no scheme", "sns.ap-south-1.amazonaws.com/cert.pem"],
  ])("rejects a certificate URL with %s", (_label, url) => {
    expect(isValidSigningCertUrl(url)).toBe(false);
  });

  it("accepts an https SubscribeURL on an SNS host", () => {
    expect(isValidSubscribeUrl(SUBSCRIBE_URL)).toBe(true);
  });

  it.each([
    "http://sns.ap-south-1.amazonaws.com/?Action=ConfirmSubscription",
    "https://169.254.169.254/latest/meta-data/",
    "https://localhost/internal",
    "https://sns.ap-south-1.amazonaws.com.evil.example/?Action=ConfirmSubscription",
    "file:///etc/passwd",
  ])("rejects SubscribeURL %s", (url) => {
    expect(isValidSubscribeUrl(url)).toBe(false);
  });
});

describe("publicKeyFromCertificate", () => {
  it("reads the public key out of a PEM certificate", () => {
    expect(publicKeyFromCertificate(TEST_CERT).asymmetricKeyType).toBe("rsa");
  });

  it("throws on something that isn't a certificate", () => {
    expect(() => publicKeyFromCertificate("<html>not a cert</html>")).toThrow();
  });
});

describe("parseSnsEnvelope", () => {
  it("accepts a well-formed envelope and treats a null Subject as absent", () => {
    const parsed = parseSnsEnvelope({ ...sign(notification()), Subject: null });
    expect(parsed?.Type).toBe("Notification");
    expect(parsed?.Subject).toBeUndefined();
  });

  it("rejects bodies that aren't SNS envelopes", () => {
    expect(parseSnsEnvelope(null)).toBeNull();
    expect(parseSnsEnvelope([])).toBeNull();
    expect(parseSnsEnvelope({ eventType: "Bounce" })).toBeNull();
    expect(parseSnsEnvelope({ ...notification(), Type: "Other" })).toBeNull();
    expect(parseSnsEnvelope({ ...notification(), Message: { eventType: "Bounce" } })).toBeNull();
  });
});

describe("topic allow-list", () => {
  it("parses a comma-separated list", () => {
    expect(parseTopicAllowList(` ${TOPIC} , arn:b ,`)).toEqual([TOPIC, "arn:b"]);
    expect(parseTopicAllowList(undefined)).toEqual([]);
  });

  it("allows only listed topics, or any topic when unconfigured", () => {
    const stranger = "arn:aws:sns:us-east-1:999999999999:evil";
    expect(isAllowedTopic(TOPIC, [TOPIC])).toBe(true);
    expect(isAllowedTopic(stranger, [TOPIC])).toBe(false);
    expect(isAllowedTopic(stranger, [])).toBe(true);
  });
});

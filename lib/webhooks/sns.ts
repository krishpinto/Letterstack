import { X509Certificate, createVerify, type KeyObject } from "node:crypto";

/**
 * Amazon SNS message verification for the SES event webhook.
 *
 * The webhook is a public URL, so anything that reaches it is untrusted until
 * proven otherwise: a forged Bounce or Complaint would suppress a real
 * address, and a forged SubscriptionConfirmation would make the server fetch a
 * URL of the sender's choosing. SNS signs every message it delivers with a
 * certificate it hosts on an sns.<region>.amazonaws.com URL; checking that
 * signature (and that the message came from our topic) is what makes the
 * payload trustworthy.
 *
 * Written in-house rather than pulled in as a dependency: the algorithm is
 * small and fully specified by AWS, node:crypto does all the cryptography,
 * and the npm validators either predate SignatureVersion 2 or bring their own
 * HTTP stack. Keeping it here also keeps every rule testable without network.
 *
 * Spec: https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html
 */

export type SnsMessageType =
  | "Notification"
  | "SubscriptionConfirmation"
  | "UnsubscribeConfirmation";

export type SnsMessage = {
  Type: SnsMessageType;
  MessageId: string;
  TopicArn: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  Subject?: string;
  SubscribeURL?: string;
  Token?: string;
};

// The only hosts SNS serves signing certificates and subscription links from.
// Anchored on both ends: "sns.us-east-1.amazonaws.com.evil.example" and
// "evilsns.us-east-1.amazonaws.com" must both fail.
const SNS_HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/;

const MESSAGE_TYPES = new Set<string>([
  "Notification",
  "SubscriptionConfirmation",
  "UnsubscribeConfirmation",
]);

/**
 * Narrows an arbitrary JSON body to an SNS envelope, or returns null. Every
 * field the signature covers must be a string: a number or object would be
 * stringified differently by us than by SNS, and the check would be
 * meaningless.
 */
export function parseSnsEnvelope(body: unknown): SnsMessage | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;

  const required = [
    "Type",
    "MessageId",
    "TopicArn",
    "Message",
    "Timestamp",
    "SignatureVersion",
    "Signature",
    "SigningCertURL",
  ];
  for (const key of required) {
    if (typeof record[key] !== "string") return null;
  }
  for (const key of ["Subject", "SubscribeURL", "Token"]) {
    if (record[key] !== undefined && record[key] !== null && typeof record[key] !== "string") {
      return null;
    }
  }
  if (!MESSAGE_TYPES.has(record.Type as string)) return null;

  return {
    Type: record.Type as SnsMessageType,
    MessageId: record.MessageId as string,
    TopicArn: record.TopicArn as string,
    Message: record.Message as string,
    Timestamp: record.Timestamp as string,
    SignatureVersion: record.SignatureVersion as string,
    Signature: record.Signature as string,
    SigningCertURL: record.SigningCertURL as string,
    // SNS sends "Subject": null when a notification has no subject. Null and
    // absent are the same thing for signing: the key is left out entirely.
    Subject: typeof record.Subject === "string" ? record.Subject : undefined,
    SubscribeURL: typeof record.SubscribeURL === "string" ? record.SubscribeURL : undefined,
    Token: typeof record.Token === "string" ? record.Token : undefined,
  };
}

/**
 * The exact byte string SNS signed: selected keys in a fixed (alphabetical)
 * order, each as "Key\nValue\n". Notifications include Subject only when the
 * message has one; confirmations sign SubscribeURL and Token instead.
 * Returns null when a key the type requires is missing.
 */
export function snsStringToSign(message: SnsMessage): string | null {
  const keys =
    message.Type === "Notification"
      ? ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"]
      : ["Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type"];

  let output = "";
  for (const key of keys) {
    const value = message[key as keyof SnsMessage];
    if (value === undefined) {
      if (key === "Subject") continue;
      return null;
    }
    output += `${key}\n${value}\n`;
  }
  return output;
}

/** SignatureVersion → the digest SNS signed with. Anything else is refused. */
export function snsSignatureAlgorithm(version: string): "RSA-SHA1" | "RSA-SHA256" | null {
  if (version === "1") return "RSA-SHA1";
  if (version === "2") return "RSA-SHA256";
  return null;
}

function parseHttpsUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    // Credentials or a non-default port have no business in an AWS URL and
    // would let a crafted URL look like one host while meaning another.
    if (url.username || url.password || url.port) return null;
    return url;
  } catch {
    return null;
  }
}

/** True for an https URL on an SNS host. Shared by the cert and subscribe checks. */
export function isSnsHostUrl(value: string): boolean {
  const url = parseHttpsUrl(value);
  return url !== null && SNS_HOST.test(url.hostname);
}

/**
 * SigningCertURL must be an https .pem on an SNS host. This is the line
 * between "verify against AWS's key" and "verify against a key the attacker
 * supplied", so it is deliberately strict.
 */
export function isValidSigningCertUrl(value: string): boolean {
  const url = parseHttpsUrl(value);
  if (!url || !SNS_HOST.test(url.hostname)) return false;
  if (url.search || url.hash) return false;
  return url.pathname.endsWith(".pem");
}

/**
 * SubscribeURL must be https on an SNS host. Fetching it is how a
 * subscription gets confirmed, so without this check a signed-looking
 * payload could aim the server at any internal or external URL (SSRF).
 */
export function isValidSubscribeUrl(value: string): boolean {
  return isSnsHostUrl(value);
}

/** Extracts the public key from a PEM certificate, or throws. */
export function publicKeyFromCertificate(pem: string): KeyObject {
  const certificate = new X509Certificate(pem);
  const now = Date.now();
  if (now < Date.parse(certificate.validFrom) || now > Date.parse(certificate.validTo)) {
    throw new Error("SNS signing certificate is outside its validity period");
  }
  return certificate.publicKey;
}

/** Checks the message signature against a public key. Never throws. */
export function verifySnsSignature(message: SnsMessage, publicKey: KeyObject | string): boolean {
  const algorithm = snsSignatureAlgorithm(message.SignatureVersion);
  const stringToSign = snsStringToSign(message);
  if (!algorithm || stringToSign === null) return false;

  try {
    const verifier = createVerify(algorithm);
    verifier.update(stringToSign, "utf8");
    return verifier.verify(publicKey, message.Signature, "base64");
  } catch {
    return false;
  }
}

// Certificates rotate rarely, and one warm serverless instance sees many
// events, so caching per instance saves a round trip to AWS on almost every
// request. Capped because the cert URL comes from the request: even limited to
// SNS hosts, its path is attacker-chosen and must not grow memory unbounded.
const CERT_CACHE_LIMIT = 16;
const certCache = new Map<string, KeyObject>();

async function fetchSigningKey(certUrl: string): Promise<KeyObject> {
  const cached = certCache.get(certUrl);
  if (cached) return cached;

  const response = await fetch(certUrl, {
    // A redirect could leave the SNS host the URL was checked against.
    redirect: "error",
    signal: AbortSignal.timeout(5_000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`SNS signing certificate fetch failed: ${response.status}`);
  }
  const key = publicKeyFromCertificate(await response.text());

  // Only successful fetches are cached: a transient failure must not stick.
  if (certCache.size >= CERT_CACHE_LIMIT) {
    const oldest = certCache.keys().next().value;
    if (oldest !== undefined) certCache.delete(oldest);
  }
  certCache.set(certUrl, key);
  return key;
}

export type SnsVerification =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Full verification: certificate URL, signature version, signature. The key
 * loader is injectable so tests run against a local keypair instead of AWS.
 */
export async function verifySnsMessage(
  message: SnsMessage,
  loadKey: (certUrl: string) => Promise<KeyObject | string> = fetchSigningKey,
): Promise<SnsVerification> {
  if (!snsSignatureAlgorithm(message.SignatureVersion)) {
    return { ok: false, reason: `unsupported SignatureVersion ${message.SignatureVersion}` };
  }
  if (!isValidSigningCertUrl(message.SigningCertURL)) {
    return { ok: false, reason: "SigningCertURL is not an SNS certificate URL" };
  }

  let key: KeyObject | string;
  try {
    key = await loadKey(message.SigningCertURL);
  } catch (err) {
    return {
      ok: false,
      reason: `could not load signing certificate: ${err instanceof Error ? err.message : err}`,
    };
  }

  return verifySnsSignature(message, key)
    ? { ok: true }
    : { ok: false, reason: "signature does not match" };
}

/**
 * The comma-separated SES_EVENTS_TOPIC_ARN allow-list. An empty list means
 * "not configured", which the caller treats as allow-with-warning: the
 * signature check still guarantees the message came from SNS, just not from
 * which topic.
 */
export function parseTopicAllowList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function isAllowedTopic(topicArn: string, allowList: string[]): boolean {
  return allowList.length === 0 || allowList.includes(topicArn);
}

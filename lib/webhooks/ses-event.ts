/**
 * Turns one SES event (the JSON inside an SNS Notification's Message) into
 * what the webhook acts on: the event type, every affected recipient, whether
 * each one should be suppressed, and the ids our sends tagged it with.
 *
 * Handles both shapes SES produces: configuration-set event publishing
 * ("eventType") and identity notifications ("notificationType").
 */

export type SesEventRecipient = {
  email: string;
  /** Hard bounces and complaints. Soft bounces are recorded, never suppressed. */
  suppress: boolean;
};

export type ParsedSesEvent = {
  type: string;
  recipients: SesEventRecipient[];
  /** Tag values, only when they are well-formed ids (see readIdTag). */
  campaignId: string | null;
  automationId: string | null;
};

type Json = Record<string, unknown>;

function asObject(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reads a tag that should carry one of our row ids. SES echoes tags back
 * verbatim and the events table stores campaign ids in a uuid column, so a
 * tag that is not a uuid (an invoice's "type" tag, a hand-sent test) is
 * treated as absent rather than allowed to fail the insert and make SNS retry
 * the same message for an hour.
 */
export function readIdTag(event: unknown, name: string): string | null {
  const tags = asObject(asObject(asObject(event)?.mail)?.tags);
  const value = asArray(tags?.[name])[0];
  return typeof value === "string" && UUID.test(value) ? value.toLowerCase() : null;
}

/**
 * Only a Permanent bounce means the address will never accept mail.
 * Transient (mailbox full, message too large) and Undetermined bounces can
 * succeed next time, and suppressing them would silently drop real readers.
 */
export function isHardBounce(bounceType: unknown): boolean {
  return bounceType === "Permanent";
}

function emailsFrom(list: unknown, field: string | null): string[] {
  return asArray(list)
    .map((entry) => (field ? asObject(entry)?.[field] : entry))
    .filter((email): email is string => typeof email === "string")
    .map((email) => email.trim())
    .filter(Boolean);
}

function unique(emails: string[]): string[] {
  return [...new Set(emails)];
}

export function parseSesEvent(event: unknown): ParsedSesEvent | null {
  const record = asObject(event);
  if (!record) return null;

  const rawType = record.eventType ?? record.notificationType;
  const type = typeof rawType === "string" && rawType ? rawType : "Unknown";
  const destination = emailsFrom(asObject(record.mail)?.destination, null);

  const recipients = recipientsFor(type, record, destination);

  return {
    type,
    recipients,
    campaignId: readIdTag(record, "campaignId"),
    automationId: readIdTag(record, "automationId"),
  };
}

function recipientsFor(type: string, record: Json, destination: string[]): SesEventRecipient[] {
  const notSuppressed = (emails: string[]) =>
    unique(emails).map((email) => ({ email, suppress: false }));

  if (type === "Bounce" || type === "Complaint") {
    const named =
      type === "Bounce"
        ? emailsFrom(asObject(record.bounce)?.bouncedRecipients, "emailAddress")
        : emailsFrom(asObject(record.complaint)?.complainedRecipients, "emailAddress");

    // SES always names who bounced or complained. If a payload ever doesn't,
    // the event is still worth counting, but suppressing the whole
    // destination list on a guess is not.
    if (named.length === 0) return notSuppressed(destination);

    // Every complaint suppresses: someone marked the mail as spam, and
    // mailing them again is what pushes an SES account into review.
    const suppress = type === "Complaint" || isHardBounce(asObject(record.bounce)?.bounceType);
    return unique(named).map((email) => ({ email, suppress }));
  }

  if (type === "Delivery") {
    const delivered = emailsFrom(asObject(record.delivery)?.recipients, null);
    return notSuppressed(delivered.length > 0 ? delivered : destination);
  }

  return notSuppressed(destination);
}


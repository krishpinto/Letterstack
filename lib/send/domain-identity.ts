// Custom sending domains: register a customer's domain as an SES identity in
// OUR AWS account and report its verification state. We never touch the
// customer's DNS — callers show them the records to paste into their provider.
//
// Verification = DKIM (proves mail is signed for their domain) + custom
// MAIL FROM (mail.<domain>, gives SPF alignment so DMARC passes). Both must be
// green before the send path may use the domain.

import {
  CreateEmailIdentityCommand,
  DeleteEmailIdentityCommand,
  GetEmailIdentityCommand,
  PutEmailIdentityMailFromAttributesCommand,
  SESv2Client,
} from "@aws-sdk/client-sesv2";

let client: SESv2Client | null = null;
function ses(): SESv2Client {
  if (!client) client = new SESv2Client({ region: process.env.AWS_REGION });
  return client;
}

/** Hostname like "acme.org" or "news.acme.org" — no scheme, no @, no spaces. */
export const DOMAIN_RE =
  /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

export function isValidDomain(domain: string): boolean {
  return DOMAIN_RE.test(domain);
}

/** The envelope (MAIL FROM) subdomain — gives the customer SPF alignment. */
export function mailFromDomain(domain: string): string {
  return `mail.${domain}`;
}

export type DomainDnsRecord = {
  type: "CNAME" | "MX" | "TXT";
  host: string;
  /** Always a hostname or text value — never an IP address. */
  value: string;
  /** MX only. DNS panels ask for this as its own field. */
  priority?: number;
  purpose: string;
  /** Which SES status this record's verification is reported under. */
  group: "dkim" | "mailFrom";
};

export function dnsRecordsForDomain(
  domain: string,
  dkimTokens: string[],
): DomainDnsRecord[] {
  const region = process.env.AWS_REGION;
  return [
    ...dkimTokens.map((token, i): DomainDnsRecord => ({
      type: "CNAME",
      host: `${token}._domainkey.${domain}`,
      value: `${token}.dkim.amazonses.com`,
      purpose: `DKIM signature ${i + 1} of ${dkimTokens.length}`,
      group: "dkim",
    })),
    {
      type: "MX",
      host: mailFromDomain(domain),
      value: `feedback-smtp.${region}.amazonses.com`,
      priority: 10,
      purpose: "Bounce return path (MAIL FROM)",
      group: "mailFrom",
    },
    {
      type: "TXT",
      host: mailFromDomain(domain),
      value: "v=spf1 include:amazonses.com ~all",
      purpose: "SPF for MAIL FROM",
      group: "mailFrom",
    },
  ];
}

export type DomainIdentityStatus = {
  domain: string;
  dkimStatus: string;
  mailFromStatus: string;
  /** True only when SES will accept sends AND MAIL FROM is aligned. */
  readyToSend: boolean;
  records: DomainDnsRecord[];
};

/**
 * Create the SES identity for `domain` with our configuration set. Reports
 * whether it already existed instead of quietly succeeding: an existing
 * identity may already be verified, and only the caller knows whether the
 * workspace asking is entitled to it (see decideAddIdentity).
 */
export async function createDomainIdentity(
  domain: string,
): Promise<"created" | "exists"> {
  try {
    await ses().send(
      new CreateEmailIdentityCommand({
        EmailIdentity: domain,
        ConfigurationSetName: process.env.SES_CONFIGURATION_SET,
      }),
    );
    return "created";
  } catch (err) {
    if ((err as Error).name === "AlreadyExistsException") return "exists";
    throw err;
  }
}

/** Apply the custom MAIL FROM to an identity and return its current state. */
export async function configureDomainIdentity(
  domain: string,
): Promise<DomainIdentityStatus> {
  await ses().send(
    new PutEmailIdentityMailFromAttributesCommand({
      EmailIdentity: domain,
      MailFromDomain: mailFromDomain(domain),
      BehaviorOnMxFailure: "USE_DEFAULT_VALUE",
    }),
  );

  return getDomainIdentityStatus(domain);
}

/**
 * Create-or-reuse plus configure, with no ownership check. For the operator
 * CLI (scripts/connect-domain.ts) only — the dashboard goes through
 * createDomainIdentity so it can refuse an identity it doesn't own.
 */
export async function registerDomainIdentity(
  domain: string,
): Promise<DomainIdentityStatus> {
  await createDomainIdentity(domain);
  return configureDomainIdentity(domain);
}

/** Current SES verification state + the DNS records the owner must publish. */
export async function getDomainIdentityStatus(
  domain: string,
): Promise<DomainIdentityStatus> {
  const identity = await ses().send(
    new GetEmailIdentityCommand({ EmailIdentity: domain }),
  );

  const dkimStatus = identity.DkimAttributes?.Status ?? "UNKNOWN";
  const mailFromStatus =
    identity.MailFromAttributes?.MailFromDomainStatus ?? "NOT_SET";

  return {
    domain,
    dkimStatus,
    mailFromStatus,
    readyToSend:
      Boolean(identity.VerifiedForSendingStatus) && mailFromStatus === "SUCCESS",
    records: dnsRecordsForDomain(domain, identity.DkimAttributes?.Tokens ?? []),
  };
}

export async function deleteDomainIdentity(domain: string): Promise<void> {
  await ses().send(new DeleteEmailIdentityCommand({ EmailIdentity: domain }));
}

/**
 * Delete the identity, treating "already gone" as success. Releasing is the
 * goal, so an identity someone already removed by hand is not an error.
 */
export async function releaseDomainIdentity(domain: string): Promise<void> {
  try {
    await deleteDomainIdentity(domain);
  } catch (err) {
    if ((err as Error).name !== "NotFoundException") throw err;
  }
}

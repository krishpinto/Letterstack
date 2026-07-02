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

/** Hostname like "ciba.org" or "news.ciba.org" — no scheme, no @, no spaces. */
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
 * Register `domain` as an SES identity with our configuration set and a custom
 * MAIL FROM. Safe to call again for an existing identity (it re-applies the
 * MAIL FROM setting and returns current state).
 */
export async function registerDomainIdentity(
  domain: string,
): Promise<DomainIdentityStatus> {
  try {
    await ses().send(
      new CreateEmailIdentityCommand({
        EmailIdentity: domain,
        ConfigurationSetName: process.env.SES_CONFIGURATION_SET,
      }),
    );
  } catch (err) {
    if ((err as Error).name !== "AlreadyExistsException") throw err;
  }

  await ses().send(
    new PutEmailIdentityMailFromAttributesCommand({
      EmailIdentity: domain,
      MailFromDomain: mailFromDomain(domain),
      BehaviorOnMxFailure: "USE_DEFAULT_VALUE",
    }),
  );

  return getDomainIdentityStatus(domain);
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

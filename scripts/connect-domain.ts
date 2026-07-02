// Connect a customer's domain to our SES account so campaigns can send from
// their addresses (e.g. newsletter@ciba.org). We never touch the customer's
// DNS — this prints the records they paste into their own provider.
//
//   npx tsx scripts/connect-domain.ts add <domain>     register + print DNS records
//   npx tsx scripts/connect-domain.ts check <domain>   is it verified yet?
//   npx tsx scripts/connect-domain.ts records <domain> reprint the DNS records
//   npx tsx scripts/connect-domain.ts list             all identities + status
//   npx tsx scripts/connect-domain.ts remove <domain>  delete the identity from SES
import { config } from "dotenv";
config({ path: ".env.local" });

import {
  CreateEmailIdentityCommand,
  DeleteEmailIdentityCommand,
  GetEmailIdentityCommand,
  ListEmailIdentitiesCommand,
  PutEmailIdentityMailFromAttributesCommand,
  SESv2Client,
} from "@aws-sdk/client-sesv2";

const region = process.env.AWS_REGION;
const configurationSet = process.env.SES_CONFIGURATION_SET;
if (!region || !configurationSet) {
  console.error("AWS_REGION and SES_CONFIGURATION_SET must be set in .env.local");
  process.exit(1);
}

const ses = new SESv2Client({ region });

/** The envelope (MAIL FROM) subdomain — gives the customer SPF alignment. */
const mailFromDomain = (domain: string) => `mail.${domain}`;

type DnsRecord = { type: string; host: string; value: string; purpose: string };

function dnsRecords(domain: string, dkimTokens: string[]): DnsRecord[] {
  return [
    ...dkimTokens.map((token, i) => ({
      type: "CNAME",
      host: `${token}._domainkey.${domain}`,
      value: `${token}.dkim.amazonses.com`,
      purpose: `DKIM signature ${i + 1} of ${dkimTokens.length}`,
    })),
    {
      type: "MX",
      host: mailFromDomain(domain),
      value: `10 feedback-smtp.${region}.amazonses.com`,
      purpose: "Bounce return path (MAIL FROM)",
    },
    {
      type: "TXT",
      host: mailFromDomain(domain),
      value: '"v=spf1 include:amazonses.com ~all"',
      purpose: "SPF for MAIL FROM",
    },
  ];
}

function printRecords(domain: string, dkimTokens: string[]) {
  console.log(`\nDNS records for ${domain} — send these to the domain owner:\n`);
  for (const r of dnsRecords(domain, dkimTokens)) {
    console.log(`  [${r.purpose}]`);
    console.log(`    Type:  ${r.type}`);
    console.log(`    Host:  ${r.host}`);
    console.log(`    Value: ${r.value}\n`);
  }
  console.log(
    [
      "Notes for the domain owner:",
      "  - Some DNS panels (GoDaddy, Namecheap) auto-append the domain to Host.",
      `    If so, enter the Host WITHOUT the trailing ".${domain}" part.`,
      "  - No existing records need to change; these are all additions.",
      "  - If the domain has no DMARC record yet, we recommend adding:",
      `      TXT  _dmarc.${domain}  "v=DMARC1; p=none;"`,
      "",
      `Once added, run: npx tsx scripts/connect-domain.ts check ${domain}`,
    ].join("\n"),
  );
}

async function getIdentity(domain: string) {
  return ses.send(new GetEmailIdentityCommand({ EmailIdentity: domain }));
}

async function add(domain: string) {
  try {
    await ses.send(
      new CreateEmailIdentityCommand({
        EmailIdentity: domain,
        ConfigurationSetName: configurationSet,
      }),
    );
    console.log(`Created SES identity for ${domain}.`);
  } catch (err) {
    if ((err as Error).name !== "AlreadyExistsException") throw err;
    console.log(`${domain} is already registered in SES — reprinting its records.`);
  }

  await ses.send(
    new PutEmailIdentityMailFromAttributesCommand({
      EmailIdentity: domain,
      MailFromDomain: mailFromDomain(domain),
      BehaviorOnMxFailure: "USE_DEFAULT_VALUE",
    }),
  );

  const identity = await getIdentity(domain);
  const tokens = identity.DkimAttributes?.Tokens ?? [];
  if (tokens.length === 0) {
    console.error("SES returned no DKIM tokens — check the identity in the console.");
    process.exit(1);
  }
  printRecords(domain, tokens);
}

async function records(domain: string) {
  const identity = await getIdentity(domain);
  printRecords(domain, identity.DkimAttributes?.Tokens ?? []);
}

async function check(domain: string) {
  const identity = await getIdentity(domain);
  const dkim = identity.DkimAttributes?.Status ?? "UNKNOWN";
  const mailFrom = identity.MailFromAttributes?.MailFromDomainStatus ?? "NOT_SET";
  const verified = identity.VerifiedForSendingStatus ? "YES" : "not yet";

  console.log(`\n${domain}`);
  console.log(`  DKIM:              ${dkim}`);
  console.log(`  MAIL FROM:         ${mailFrom}`);
  console.log(`  Ready to send:     ${verified}\n`);

  if (identity.VerifiedForSendingStatus && mailFrom === "SUCCESS") {
    console.log("All green — campaigns can now send from this domain.");
  } else {
    console.log(
      "Still waiting on DNS. Records can take minutes to a few hours to propagate;\nSES re-checks automatically. Run this command again later.",
    );
  }
}

async function list() {
  const result = await ses.send(new ListEmailIdentitiesCommand({ PageSize: 50 }));
  console.log("\nSES identities in this account:\n");
  for (const identity of result.EmailIdentities ?? []) {
    const status = identity.SendingEnabled ? "verified" : "pending/failed";
    console.log(`  ${identity.IdentityName}  (${identity.IdentityType}, ${status})`);
  }
  console.log("");
}

async function remove(domain: string) {
  await ses.send(new DeleteEmailIdentityCommand({ EmailIdentity: domain }));
  console.log(`Removed ${domain} from SES. Its DNS records can be deleted too.`);
}

async function main() {
  const [command, domain] = process.argv.slice(2);
  const needsDomain = ["add", "check", "records", "remove"];

  if (needsDomain.includes(command) && !domain) {
    console.error(`Usage: npx tsx scripts/connect-domain.ts ${command} <domain>`);
    process.exit(1);
  }

  if (command === "add") return add(domain);
  if (command === "check") return check(domain);
  if (command === "records") return records(domain);
  if (command === "list") return list();
  if (command === "remove") return remove(domain);

  console.error(
    "Usage: npx tsx scripts/connect-domain.ts <add|check|records|list|remove> [domain]",
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

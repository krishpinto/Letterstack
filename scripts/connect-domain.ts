// Connect a customer's domain to our SES account so campaigns can send from
// their addresses (e.g. newsletter@acme.org). We never touch the customer's
// DNS — this prints the records they paste into their own provider.
//
// The dashboard Domains page does the same thing per-organization; this CLI is
// the concierge/ops path. Both share lib/send/domain-identity.ts.
//
//   npx tsx scripts/connect-domain.ts add <domain>     register + print DNS records
//   npx tsx scripts/connect-domain.ts check <domain>   is it verified yet?
//   npx tsx scripts/connect-domain.ts records <domain> reprint the DNS records
//   npx tsx scripts/connect-domain.ts list             all identities + status
//   npx tsx scripts/connect-domain.ts remove <domain>  delete the identity from SES
import { config } from "dotenv";
config({ path: ".env.local" });

import { ListEmailIdentitiesCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import type { DomainIdentityStatus } from "../lib/send/domain-identity";

async function main() {
  if (!process.env.AWS_REGION || !process.env.SES_CONFIGURATION_SET) {
    console.error("AWS_REGION and SES_CONFIGURATION_SET must be set in .env.local");
    process.exit(1);
  }

  // Imported after dotenv so the lib reads the loaded env.
  const { deleteDomainIdentity, getDomainIdentityStatus, registerDomainIdentity } =
    await import("../lib/send/domain-identity");

  function printRecords(status: DomainIdentityStatus) {
    console.log(
      `\nDNS records for ${status.domain} — send these to the domain owner:\n`,
    );
    for (const r of status.records) {
      console.log(`  [${r.purpose}]`);
      console.log(`    Type:     ${r.type}`);
      console.log(`    Host:     ${r.host}`);
      console.log(`    Value:    ${r.value}`);
      if (r.priority !== undefined) console.log(`    Priority: ${r.priority}`);
      console.log("");
    }
    console.log(
      [
        "Notes for the domain owner:",
        "  - Every Value is a hostname or text — never an IP address.",
        "  - Leave TTL on Auto/default. On Cloudflare, set records to \"DNS only\"",
        "    (grey cloud), not Proxied — proxying breaks verification.",
        "  - Some DNS panels (GoDaddy, Namecheap) auto-append the domain to Host.",
        `    If so, enter the Host WITHOUT the trailing ".${status.domain}" part.`,
        "  - No existing records need to change; these are all additions.",
        "  - If the domain has no DMARC record yet, we recommend adding:",
        `      TXT  _dmarc.${status.domain}  "v=DMARC1; p=none;"`,
        "",
        `Once added, run: npx tsx scripts/connect-domain.ts check ${status.domain}`,
      ].join("\n"),
    );
  }

  function printStatus(status: DomainIdentityStatus) {
    console.log(`\n${status.domain}`);
    console.log(`  DKIM:          ${status.dkimStatus}`);
    console.log(`  MAIL FROM:     ${status.mailFromStatus}`);
    console.log(`  Ready to send: ${status.readyToSend ? "YES" : "not yet"}\n`);
    if (status.readyToSend) {
      console.log("All green — campaigns can now send from this domain.");
    } else {
      console.log(
        "Still waiting on DNS. Records can take minutes to a few hours to propagate;\nSES re-checks automatically. Run this command again later.",
      );
    }
  }

  const [command, domain] = process.argv.slice(2);
  const needsDomain = ["add", "check", "records", "remove"];
  if (needsDomain.includes(command) && !domain) {
    console.error(`Usage: npx tsx scripts/connect-domain.ts ${command} <domain>`);
    process.exit(1);
  }

  if (command === "add") {
    const status = await registerDomainIdentity(domain);
    console.log(`Registered SES identity for ${domain}.`);
    return printRecords(status);
  }
  if (command === "records") {
    return printRecords(await getDomainIdentityStatus(domain));
  }
  if (command === "check") {
    return printStatus(await getDomainIdentityStatus(domain));
  }
  if (command === "remove") {
    await deleteDomainIdentity(domain);
    console.log(`Removed ${domain} from SES. Its DNS records can be deleted too.`);
    return;
  }
  if (command === "list") {
    const ses = new SESv2Client({ region: process.env.AWS_REGION });
    const result = await ses.send(new ListEmailIdentitiesCommand({ PageSize: 50 }));
    console.log("\nSES identities in this account:\n");
    for (const identity of result.EmailIdentities ?? []) {
      const state = identity.SendingEnabled ? "verified" : "pending/failed";
      console.log(`  ${identity.IdentityName}  (${identity.IdentityType}, ${state})`);
    }
    console.log("");
    return;
  }

  console.error(
    "Usage: npx tsx scripts/connect-domain.ts <add|check|records|list|remove> [domain]",
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

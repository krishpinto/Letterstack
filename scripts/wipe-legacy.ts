// One-off: remove pre-multi-tenant test rows that have no owner (user_id NULL).
// These must go before the NOT NULL constraint can be applied. Run once:
//   npx tsx scripts/wipe-legacy.ts
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../db/client");
  const { campaigns, recipients, suppressedEmails } = await import("../db/schema");

  // Deleting campaigns/recipients cascades to campaign_recipients.
  await db.delete(campaigns);
  await db.delete(recipients);
  // Old global suppression rows have no owner — clear before NOT NULL applies.
  await db.delete(suppressedEmails);

  console.log("Wiped legacy campaigns + recipients + suppression (owner-less test data).");
  process.exit(0);
}

main();

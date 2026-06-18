// One-off: flip campaigns that are stuck at "sending" but have actually finished
// (no recipients left pending) over to "sent". These predate the completion fix
// in the campaign worker. Safe to re-run. Run once:
//   npx tsx scripts/fix-stuck-campaigns.ts
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../db/client");
  const { campaigns, campaignRecipients } = await import("../db/schema");
  const { and, eq, notInArray } = await import("drizzle-orm");

  // Campaign ids that still have at least one pending recipient — genuinely sending.
  const pendingRows = await db
    .selectDistinct({ campaignId: campaignRecipients.campaignId })
    .from(campaignRecipients)
    .where(eq(campaignRecipients.status, "pending"));
  const stillPending = pendingRows.map((r) => r.campaignId);

  // Flip every "sending" campaign that has NO pending recipients to "sent".
  // (A campaign with zero recipient rows counts as done too — nothing pending.)
  const flipped = await db
    .update(campaigns)
    .set({ status: "sent" })
    .where(
      and(
        eq(campaigns.status, "sending"),
        stillPending.length ? notInArray(campaigns.id, stillPending) : undefined,
      ),
    )
    .returning({ id: campaigns.id, name: campaigns.name });

  console.log(`Flipped ${flipped.length} stuck campaign(s) to "sent":`);
  flipped.forEach((c) => console.log(`  - ${c.name ?? "(unnamed)"} (${c.id})`));
  process.exit(0);
}

main();

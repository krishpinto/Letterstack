// One-off: reset campaigns stuck in "sending" (a batch never completed) back to
// "draft" and clear their frozen recipients, so they can be cleanly re-sent from
// the UI. Run: npx tsx scripts/recover-stuck.ts
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../db/client");
  const { campaigns, campaignRecipients } = await import("../db/schema");
  const { eq } = await import("drizzle-orm");

  const stuck = await db
    .select({ id: campaigns.id, name: campaigns.name })
    .from(campaigns)
    .where(eq(campaigns.status, "sending"));

  if (stuck.length === 0) {
    console.log("No campaigns stuck in 'sending'.");
    process.exit(0);
  }

  for (const c of stuck) {
    await db.delete(campaignRecipients).where(eq(campaignRecipients.campaignId, c.id));
    await db.update(campaigns).set({ status: "draft", sentAt: null }).where(eq(campaigns.id, c.id));
    console.log(`Reset to draft: ${c.name} (${c.id})`);
  }
  console.log(`\nDone — ${stuck.length} campaign(s) reset. Re-send them from the UI.`);
  process.exit(0);
}

main();

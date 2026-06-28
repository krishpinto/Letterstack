// One-off: inspect why a campaign is stuck "sending". Run:
//   npx tsx scripts/diagnose-send.ts
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../db/client");
  const { campaigns, campaignRecipients, recipients, suppressedEmails } = await import("../db/schema");
  const { eq, desc, sql } = await import("drizzle-orm");

  const recent = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      status: campaigns.status,
      userId: campaigns.userId,
      fromEmail: campaigns.fromEmail,
      createdAt: campaigns.createdAt,
    })
    .from(campaigns)
    .orderBy(desc(campaigns.createdAt))
    .limit(5);

  console.log("\n=== 5 most recent campaigns ===");
  for (const c of recent) {
    const counts = await db
      .select({ status: campaignRecipients.status, n: sql<number>`count(*)::int` })
      .from(campaignRecipients)
      .where(eq(campaignRecipients.campaignId, c.id))
      .groupBy(campaignRecipients.status);
    const summary = counts.map((x) => `${x.status}:${x.n}`).join(" ") || "(no rows)";
    console.log(`- ${c.name} [${c.status}] from=${c.fromEmail}`);
    console.log(`    recipients-frozen: ${summary}`);

    const totalRecipients = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(recipients)
      .where(eq(recipients.userId, c.userId));
    const supp = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(suppressedEmails)
      .where(eq(suppressedEmails.userId, c.userId));
    console.log(`    owner audience: ${totalRecipients[0]?.n ?? 0} recipients, ${supp[0]?.n ?? 0} suppressed`);
  }

  process.exit(0);
}

main();

// Adds trial tracking, then grants every existing workspace a 2-month Pro
// trial. Idempotent on both halves: the columns use IF NOT EXISTS, and the
// grant only touches rows still at plan_source='none', so re-running never
// extends a trial that's already ticking.
//
// Vought is already on a real paid plan (a settled ₹5 order). It gets marked
// 'paid', not 'trial' — overwriting it with a trial expiry would silently
// shorten something someone actually bought.

import { neon } from "@neondatabase/serverless";
import * as fs from "fs";

const envLocal = fs.readFileSync(".env.local", "utf-8");
const databaseUrlLine = envLocal.split("\n").find(line => line.startsWith("DATABASE_URL="));
if (!databaseUrlLine) {
  throw new Error("DATABASE_URL not found in .env.local");
}
const databaseUrl = databaseUrlLine.split("=")[1].trim().replace(/['"]/g, "");

const TRIAL_DAYS = 60;

async function main() {
  const sql = neon(databaseUrl);

  console.log("Adding plan_source to organizations...");
  await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan_source TEXT NOT NULL DEFAULT 'none'`;

  console.log("Adding plan_notice_seen_at to users...");
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_notice_seen_at TIMESTAMP`;

  // Plans are priced per month, so the send counter needs a window. Without
  // one, emails_sent_count is a lifetime total and every org eventually
  // wedges itself against a monthly allowance it never actually exceeded.
  console.log("Adding emails_sent_period_start to organizations...");
  await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS emails_sent_period_start TIMESTAMP`;
  await sql`UPDATE organizations SET emails_sent_period_start = date_trunc('month', now()) WHERE emails_sent_period_start IS NULL`;

  // emails_sent_count has drifted from reality — a workspace can show 0
  // against thousands genuinely sent. campaign_recipients is the actual
  // record of what left the building, so the counter is rebuilt from it for
  // the current month rather than trusted. Blocks are only as honest as the
  // number behind them.
  const rebuilt = await sql`
    UPDATE organizations o
       SET emails_sent_count = COALESCE(actual.n, 0)
      FROM (
        SELECT c.organization_id, count(*)::int AS n
          FROM campaign_recipients cr
          JOIN campaigns c ON c.id = cr.campaign_id
         WHERE cr.status = 'sent'
           AND cr.sent_at >= date_trunc('month', now())
         GROUP BY c.organization_id
      ) AS actual
     WHERE actual.organization_id = o.id
       AND o.emails_sent_count IS DISTINCT FROM actual.n
    RETURNING o.name, o.emails_sent_count
  `;
  console.log(`Rebuilt this month's send counter for ${rebuilt.length} org(s):`);
  for (const org of rebuilt) console.log(`  ${String(org.name).padEnd(24)} ${org.emails_sent_count}`);

  // Anyone already on pro got there by paying — record that before the trial
  // grant runs, so the next statement can't mistake them for an ungranted org.
  const paid = await sql`
    UPDATE organizations
       SET plan_source = 'paid'
     WHERE plan = 'pro' AND plan_source = 'none'
    RETURNING name, plan_expires_at
  `;
  console.log(`Marked ${paid.length} existing paid org(s):`, paid.map(p => p.name));

  // The grant. Only orgs that have never had a plan of any kind.
  const granted = await sql`
    UPDATE organizations
       SET plan = 'pro',
           plan_source = 'trial',
           plan_expires_at = now() + ${`${TRIAL_DAYS} days`}::interval
     WHERE plan_source = 'none'
    RETURNING name, plan_expires_at
  `;
  console.log(`Granted a ${TRIAL_DAYS}-day trial to ${granted.length} org(s):`);
  for (const org of granted) {
    console.log(`  ${String(org.name).padEnd(24)} until ${new Date(org.plan_expires_at).toDateString()}`);
  }

  const summary = await sql`
    SELECT plan, plan_source, count(*)::int AS n
      FROM organizations GROUP BY plan, plan_source ORDER BY n DESC
  `;
  console.log("\norganizations by plan:", summary);
  console.log("Done.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

// Two changes, both idempotent, both safe to re-run.
//
// 1. Re-anchor the free Pro period to each org's FIRST SEND rather than to
//    the day the grant script happened to run. An org that has never sent
//    gets a null expiry — Pro, but not yet counting — and the clock starts
//    on its first campaign (see startTrialClockOnFirstSend).
//
// 2. Create and backfill the trial_grants ledger, so every workspace that
//    has already had a free period is on record and can't quietly claim a
//    second one under a new account.
//
// Paid orgs are never touched: the guard is plan_source = 'trial' throughout.

import { neon } from "@neondatabase/serverless";
import * as fs from "fs";

import { organizationEmailDomain } from "../lib/plans/email-domains";

const envLocal = fs.readFileSync(".env.local", "utf-8");
const databaseUrlLine = envLocal.split("\n").find(line => line.startsWith("DATABASE_URL="));
if (!databaseUrlLine) throw new Error("DATABASE_URL not found in .env.local");
const databaseUrl = databaseUrlLine.split("=")[1].trim().replace(/['"]/g, "");

const TRIAL_DAYS = 60;

async function main() {
  const sql = neon(databaseUrl);

  console.log("Creating trial_grants...");
  await sql`
    CREATE TABLE IF NOT EXISTS trial_grants (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      kind text NOT NULL,
      value text NOT NULL,
      organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS trial_grants_kind_value_unq
      ON trial_grants (kind, value)
  `;

  // ---- 1. Re-anchor expiries to first send -------------------------------

  const anchored = await sql`
    UPDATE organizations o
       SET plan_expires_at = first.sent_at + ${`${TRIAL_DAYS} days`}::interval
      FROM (
        SELECT c.organization_id, min(cr.sent_at) AS sent_at
          FROM campaign_recipients cr
          JOIN campaigns c ON c.id = cr.campaign_id
         WHERE cr.status = 'sent' AND cr.sent_at IS NOT NULL
         GROUP BY c.organization_id
      ) AS first
     WHERE first.organization_id = o.id
       AND o.plan_source = 'trial'
    RETURNING o.name, o.plan_expires_at
  `;
  console.log(`\nAnchored ${anchored.length} org(s) to their first send:`);
  for (const o of anchored) {
    console.log(`  ${String(o.name).padEnd(22)} ends ${new Date(o.plan_expires_at).toDateString()}`);
  }

  // Never sent → the clock hasn't started. Null expiry reads as "Pro, not yet
  // counting" and is what startTrialClockOnFirstSend looks for.
  const unstarted = await sql`
    UPDATE organizations o
       SET plan_expires_at = NULL
     WHERE o.plan_source = 'trial'
       AND o.plan_expires_at IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM campaign_recipients cr
           JOIN campaigns c ON c.id = cr.campaign_id
          WHERE c.organization_id = o.id AND cr.status = 'sent'
       )
    RETURNING o.name
  `;
  console.log(`\nReset ${unstarted.length} never-sent org(s) to "clock not started".`);

  // ---- 2. Backfill the ledger --------------------------------------------

  // Every org that has a plan of any kind has had its free period. Record the
  // owner and, where it identifies an organisation, their email domain.
  const owners = (await sql`
    SELECT o.id AS organization_id, u.id AS user_id, u.email
      FROM organizations o
      JOIN organization_members m ON m.organization_id = o.id AND m.role = 'owner'
      JOIN users u ON u.id = m.user_id
     WHERE o.plan_source <> 'none'
  `) as { organization_id: string; user_id: string; email: string }[];

  let userRows = 0;
  let emailRows = 0;
  for (const row of owners) {
    const u = await sql`
      INSERT INTO trial_grants (kind, value, organization_id)
      VALUES ('user', ${row.user_id}, ${row.organization_id})
      ON CONFLICT (kind, value) DO NOTHING RETURNING id
    `;
    userRows += u.length;

    const domain = organizationEmailDomain(row.email);
    if (domain) {
      const e = await sql`
        INSERT INTO trial_grants (kind, value, organization_id)
        VALUES ('email_domain', ${domain}, ${row.organization_id})
        ON CONFLICT (kind, value) DO NOTHING RETURNING id
      `;
      emailRows += e.length;
    }
  }

  // Verified sending domains are the strongest identity — DNS control.
  const domains = (await sql`
    SELECT d.organization_id, lower(d.domain) AS domain
      FROM sending_domains d
      JOIN organizations o ON o.id = d.organization_id
     WHERE d.verified_at IS NOT NULL AND o.plan_source <> 'none'
  `) as { organization_id: string; domain: string }[];
  let domainRows = 0;
  for (const row of domains) {
    const r = await sql`
      INSERT INTO trial_grants (kind, value, organization_id)
      VALUES ('sending_domain', ${row.domain}, ${row.organization_id})
      ON CONFLICT (kind, value) DO NOTHING RETURNING id
    `;
    domainRows += r.length;
  }

  console.log(
    `\nLedger backfill: ${userRows} user, ${emailRows} email-domain, ${domainRows} sending-domain row(s).`,
  );

  const summary = await sql`SELECT kind, count(*)::int AS n FROM trial_grants GROUP BY kind ORDER BY kind`;
  console.log("trial_grants:", summary);

  const state = await sql`
    SELECT name, plan, plan_source,
           coalesce(to_char(plan_expires_at, 'DD Mon YYYY'), 'not started') AS expires
      FROM organizations ORDER BY plan_source, plan_expires_at NULLS LAST, name
  `;
  console.log("\nFinal plan state:");
  for (const s of state) {
    console.log(`  ${String(s.name).padEnd(22)} ${String(s.plan).padEnd(4)} ${String(s.plan_source).padEnd(6)} ${s.expires}`);
  }
  console.log("\nDone.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

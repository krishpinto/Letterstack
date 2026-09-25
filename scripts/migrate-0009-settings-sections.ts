/**
 * Applies db/migrations/0009_settings_sections.sql to Neon.
 *
 * Idempotent (IF NOT EXISTS throughout), so a re-run or a run after a
 * partial failure is safe. drizzle-kit push can't be used: it still trips
 * over the campaign_recipients drift and would offer to truncate.
 *
 * Run with: npx tsx scripts/migrate-0009-settings-sections.ts
 */
import { neon } from "@neondatabase/serverless";
import * as fs from "fs";

import { installDnsShim } from "./_dns-shim";

// Before the first query: standalone scripts don't load instrumentation.ts,
// so without this the connection dies as ENOTFOUND on this network.
installDnsShim();

const line = fs
  .readFileSync(".env.local", "utf-8")
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL="));
if (!line) throw new Error("DATABASE_URL not found in .env.local");
const databaseUrl = line.slice("DATABASE_URL=".length).trim().replace(/['"]/g, "");

async function main() {
  const sql = neon(databaseUrl);

  async function state() {
    const columns = await sql`
      SELECT table_name || '.' || column_name AS ref
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'organizations' AND column_name IN ('default_from_name', 'default_reply_to'))
          OR (table_name = 'campaigns' AND column_name = 'deliverability_alert_sent_at')
        )
      ORDER BY ref
    `;
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'notification_preferences'
    `;
    return [
      ...columns.map((r) => r.ref as string),
      ...tables.map((r) => r.table_name as string),
    ];
  }

  console.log("before:", await state());

  await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_from_name text`;
  await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_reply_to text`;

  await sql`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      campaign_finished boolean NOT NULL DEFAULT true,
      deliverability_alerts boolean NOT NULL DEFAULT true,
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (organization_id, user_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS notification_preferences_user_idx
      ON notification_preferences (user_id)
  `;

  await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS deliverability_alert_sent_at timestamptz`;

  console.log("after: ", await state());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

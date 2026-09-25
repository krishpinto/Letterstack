/**
 * Applies db/migrations/0008_api_keys.sql to Neon.
 *
 * Idempotent (IF NOT EXISTS throughout), so a re-run or a run after a
 * partial failure is safe. drizzle-kit push can't be used: it still trips
 * over the campaign_recipients drift and would offer to truncate.
 *
 * Run with: npx tsx scripts/migrate-0008-api-keys.ts
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
    const rows = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('api_keys', 'api_key_usage')
      ORDER BY table_name
    `;
    return rows.map((r) => r.table_name as string);
  }

  console.log("before:", await state());

  await sql`
    CREATE TABLE IF NOT EXISTS api_keys (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name text NOT NULL,
      key_hash text NOT NULL UNIQUE,
      prefix text NOT NULL,
      last_four text NOT NULL,
      scopes jsonb NOT NULL,
      last_used_at timestamptz,
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  console.log("api_keys ready");

  await sql`CREATE INDEX IF NOT EXISTS api_keys_organization_idx ON api_keys (organization_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS api_key_usage (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      period text NOT NULL,
      requests integer NOT NULL DEFAULT 0,
      CONSTRAINT api_key_usage_org_period_unq UNIQUE (organization_id, period)
    )
  `;
  console.log("api_key_usage ready");

  console.log("after:", await state());
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Applies db/migrations/0007_gmail_sending.sql to Neon.
 *
 * Same statements as the .sql file, but written idempotently
 * (IF NOT EXISTS everywhere) so a re-run — or a run after a partial
 * failure — is safe. drizzle-kit push can't be used: it still trips over
 * the campaign_recipients drift and would offer to truncate.
 *
 * Run with: npx tsx scripts/migrate-0007-gmail-sending.ts
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
    const [{ exists }] = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'connected_mailboxes'
      ) AS exists
    `;
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'campaigns'
        AND column_name IN ('reply_to', 'sender_type', 'mailbox_id')
      ORDER BY column_name
    `;
    return {
      table: exists as boolean,
      columns: cols.map((c) => c.column_name as string),
    };
  }

  console.log("before:", await state());

  await sql`
    CREATE TABLE IF NOT EXISTS connected_mailboxes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider text NOT NULL DEFAULT 'gmail',
      email text NOT NULL,
      display_name text,
      refresh_token_ciphertext text NOT NULL,
      refresh_token_iv text NOT NULL,
      refresh_token_tag text NOT NULL,
      access_token text,
      access_token_expires_at timestamptz,
      scope text NOT NULL,
      daily_limit integer NOT NULL DEFAULT 450,
      sent_today integer NOT NULL DEFAULT 0,
      quota_reset_at timestamptz NOT NULL DEFAULT now(),
      status text NOT NULL DEFAULT 'active',
      last_error text,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT connected_mailboxes_org_email_unq UNIQUE (organization_id, email)
    )
  `;
  console.log("connected_mailboxes ready");

  await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS reply_to text`;
  await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS sender_type text NOT NULL DEFAULT 'shared'`;
  await sql`
    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS mailbox_id uuid
      REFERENCES connected_mailboxes(id) ON DELETE SET NULL
  `;
  console.log("campaigns columns ready");

  console.log("after:", await state());
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

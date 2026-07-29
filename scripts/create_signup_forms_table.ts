import { neon } from "@neondatabase/serverless";
import * as fs from "fs";

const envLocalPath = ".env.local";
const envLocal = fs.readFileSync(envLocalPath, "utf-8");
const databaseUrlLine = envLocal
  .split("\n")
  .find((line) => line.startsWith("DATABASE_URL="));
if (!databaseUrlLine) {
  throw new Error("DATABASE_URL not found in .env.local");
}
const databaseUrl = databaseUrlLine.split("=")[1].trim().replace(/['"]/g, "");

async function main() {
  const sql = neon(databaseUrl);
  console.log("Creating signup_forms table...");
  await sql`
    CREATE TABLE IF NOT EXISTS signup_forms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      public_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      headline TEXT NOT NULL DEFAULT 'Subscribe to our newsletter',
      description TEXT NOT NULL DEFAULT 'Get our latest updates straight to your inbox.',
      button_label TEXT NOT NULL DEFAULT 'Subscribe',
      success_message TEXT NOT NULL DEFAULT 'Almost there — check your inbox to confirm your subscription.',
      accent_color TEXT NOT NULL DEFAULT '#4f46e5',
      collect_name BOOLEAN NOT NULL DEFAULT FALSE,
      subscriber_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;
  console.log("Table signup_forms created successfully.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

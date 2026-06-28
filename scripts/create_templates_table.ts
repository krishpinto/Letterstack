import { neon } from "@neondatabase/serverless";
import * as fs from "fs";

const envLocalPath = ".env.local";
const envLocal = fs.readFileSync(envLocalPath, "utf-8");
const databaseUrlLine = envLocal.split("\n").find(line => line.startsWith("DATABASE_URL="));
if (!databaseUrlLine) {
  throw new Error("DATABASE_URL not found in .env.local");
}
const databaseUrl = databaseUrlLine.split("=")[1].trim().replace(/['"]/g, "");

async function main() {
  const sql = neon(databaseUrl);
  console.log("Creating email_templates table...");
  await sql`
    CREATE TABLE IF NOT EXISTS email_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      subject TEXT DEFAULT '',
      from_name TEXT DEFAULT '',
      from_email TEXT DEFAULT '',
      document JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;
  console.log("Table email_templates created successfully.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

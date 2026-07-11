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
  console.log("Adding style columns to signup_forms...");
  // Additive and idempotent — existing rows fall back to the current default look.
  await sql`ALTER TABLE signup_forms ADD COLUMN IF NOT EXISTS layout TEXT NOT NULL DEFAULT 'card'`;
  await sql`ALTER TABLE signup_forms ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'light'`;
  await sql`ALTER TABLE signup_forms ADD COLUMN IF NOT EXISTS corner_style TEXT NOT NULL DEFAULT 'rounded'`;
  console.log("Style columns added successfully.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

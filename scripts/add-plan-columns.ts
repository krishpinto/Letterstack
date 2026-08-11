import { neon } from "@neondatabase/serverless";
import * as fs from "fs";

const envLocal = fs.readFileSync(".env.local", "utf-8");
const databaseUrlLine = envLocal.split("\n").find(line => line.startsWith("DATABASE_URL="));
if (!databaseUrlLine) {
  throw new Error("DATABASE_URL not found in .env.local");
}
const databaseUrl = databaseUrlLine.split("=")[1].trim().replace(/['"]/g, "");

async function main() {
  const sql = neon(databaseUrl);

  console.log("Adding plan columns to organizations...");
  await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free'`;
  await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP`;

  console.log("Adding item column to payments...");
  await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS item TEXT NOT NULL DEFAULT 'internal_test'`;

  const orgs = await sql`SELECT plan, count(*)::int AS n FROM organizations GROUP BY plan`;
  console.log("organizations by plan:", orgs);
  console.log("Done.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

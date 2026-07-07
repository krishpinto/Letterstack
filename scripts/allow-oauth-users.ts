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
  console.log("Making users.password_hash nullable (OAuth users have none)...");
  await sql`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`;
  console.log("Done.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

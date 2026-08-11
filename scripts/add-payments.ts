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
  console.log("Creating payments table...");
  await sql`
    CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      razorpay_order_id TEXT NOT NULL UNIQUE,
      razorpay_payment_id TEXT,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      receipt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'created',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      paid_at TIMESTAMP
    );
  `;
  console.log("Done.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

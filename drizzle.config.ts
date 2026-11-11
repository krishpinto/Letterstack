import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

import { drizzleKitRefusal } from "./db/drizzle-kit-guard";

// Load the secret connection string from .env.local so drizzle-kit can reach
// Neon. (The Next.js app loads this automatically; the drizzle-kit CLI doesn't,
// so we load it here ourselves.)
config({ path: ".env.local" });

// drizzle-kit loads this file for every command, which makes it the one
// place that can stop `npx drizzle-kit push` / `migrate` from reaching the
// production database. See db/drizzle-kit-guard.ts.
const refusal = drizzleKitRefusal(process.argv, process.env);
if (refusal) {
  console.error(`\n${refusal}\n`);
  process.exit(1);
}

export default defineConfig({
  // Where our table blueprints live.
  schema: "./db/schema.ts",
  // Scratch space for `npm run db:generate`, which drafts SQL from a
  // schema.ts change (docs/database.md). Not committed: the SQL that is
  // actually applied is hand-written in db/migrations/pending/.
  out: "./db/drizzle",
  // We're using Postgres (Neon is hosted Postgres).
  dialect: "postgresql",
  // Only needed by commands that connect (studio, and push to a branch).
  // `generate` works offline without it.
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});

import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load the secret connection string from .env.local so drizzle-kit can reach
// Neon. (The Next.js app loads this automatically; the drizzle-kit CLI doesn't,
// so we load it here ourselves.)
config({ path: ".env.local" });

export default defineConfig({
  // Where our table blueprints live.
  schema: "./db/schema.ts",
  // Where generated SQL migration files go.
  out: "./db/migrations",
  // We're using Postgres (Neon is hosted Postgres).
  dialect: "postgresql",
  // The cabinet to build the tables in.
  dbCredentials: { url: process.env.DATABASE_URL! },
});

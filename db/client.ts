import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

// One connection to Neon, made once and reused everywhere.
//
// - neon(...) opens the "phone line" to your Neon database using the secret
//   connection string from the environment (never hard-coded).
// - drizzle(...) wraps that line in our translator, giving us `db` — the
//   single handle every part of the app uses to read/write the database.
const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle({ client: sql });

import { drizzle } from "drizzle-orm/neon-http";
import { neon, neonConfig } from "@neondatabase/serverless";

import { withReadRetry } from "./read-retry";

// One connection to Neon, made once and reused everywhere.
//
// - neon(...) opens the "phone line" to your Neon database using the secret
//   connection string from the environment (never hard-coded).
// - drizzle(...) wraps that line in our translator, giving us `db` — the
//   single handle every part of the app uses to read/write the database.
//
// Every query is one HTTP request. A plain SELECT that fails on the network
// is retried twice with backoff; nothing else is, because a write whose
// request failed may still have run. See db/read-retry.ts.
neonConfig.fetchFunction = withReadRetry();

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle({ client: sql });

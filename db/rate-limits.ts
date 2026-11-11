import { sql } from "drizzle-orm";
import { db } from "./client";
import { rateLimits } from "./schema";

/**
 * Count `amount` uses of `key` against `limit` per window of
 * `windowSeconds`. Returns true, and records them, only if they all fit;
 * returns false, recording nothing, otherwise.
 *
 * One statement, so it is atomic without a transaction (neon-http has
 * none): the INSERT creates the row on first use, and on conflict the
 * UPDATE either starts a fresh window or adds to the current one. Its WHERE
 * refuses the whole update when the total would pass the limit, and then
 * RETURNING gives no row. Windows are measured with the database's own
 * now(), so app-server clocks do not matter.
 *
 * A shared lib/rate-limit.ts may arrive with the accounts work; this keeps
 * the same shape (key, amount, limit, window) so the two can converge.
 */
export async function tryConsumeRateLimit(
  key: string,
  amount: number,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  if (amount <= 0) return true;
  if (amount > limit) return false;

  const expired = sql`${rateLimits.windowStart} < now() - interval '${sql.raw(String(Math.floor(windowSeconds)))} seconds'`;
  const rows = await db
    .insert(rateLimits)
    .values({ key, windowStart: sql`now()`, count: amount })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${expired} then ${amount} else ${rateLimits.count} + ${amount} end`,
        windowStart: sql`case when ${expired} then now() else ${rateLimits.windowStart} end`,
      },
      setWhere: sql`${expired} or ${rateLimits.count} + ${amount} <= ${limit}`,
    })
    .returning({ count: rateLimits.count });
  return rows.length > 0;
}

-- Account security: email verification, session revocation, shared rate limits.
--
-- Must be applied BEFORE the code that reads these columns is deployed:
-- Drizzle selects every column in db/schema.ts, so `users` queries fail until
-- session_version exists.
--
-- Idempotent throughout, so a re-run after a partial failure is safe.

-- ── users.session_version ────────────────────────────────────────────────
-- Default 0 matches sessions issued before this column existed (they carry
-- no version, which the jwt callback reads as 0), so deploying this signs
-- nobody out.
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;

-- ── rate_limits ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  count integer NOT NULL
);

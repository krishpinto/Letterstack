-- Account security: email verification, session revocation, shared rate limits.
--
-- Must be applied BEFORE the code that reads these columns is deployed:
-- Drizzle selects every column in db/schema.ts, so `users` queries fail until
-- email_verified_at and session_version exist.
--
-- Idempotent throughout, so a re-run after a partial failure is safe.

-- ── users.email_verified_at ──────────────────────────────────────────────
-- Added and backfilled in one guarded block. Every account that exists when
-- this runs is grandfathered as verified (verified_at = created_at), or live
-- users would suddenly be blocked from sending. The guard is what keeps a
-- re-run from also "verifying" accounts that signed up after the deploy and
-- never clicked their link.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'users'
      AND column_name = 'email_verified_at'
  ) THEN
    ALTER TABLE users ADD COLUMN email_verified_at timestamp;
    UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL;
  END IF;
END $$;

-- ── users.session_version ────────────────────────────────────────────────
-- Default 0 matches sessions issued before this column existed (they carry
-- no version, which the jwt callback reads as 0), so deploying this signs
-- nobody out.
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;

-- ── email_verifications ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamp NOT NULL,
  used_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_verifications_user_id_idx
  ON email_verifications (user_id);

-- ── rate_limits ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  count integer NOT NULL
);

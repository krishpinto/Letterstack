-- Account security: email verification, session revocation, shared rate limits.
--
-- Must be applied BEFORE this branch is deployed. Until then the rate
-- limiter fails open (it logs and allows every request).
--
-- Idempotent throughout, so a re-run after a partial failure is safe.

-- ── rate_limits ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  count integer NOT NULL
);

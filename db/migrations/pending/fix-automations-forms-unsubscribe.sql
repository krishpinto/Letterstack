-- Automations, signup forms and unsubscribe fixes.
--
-- Apply BEFORE deploying the code on this branch. The automation worker
-- claims every send and delay step in automation_step_runs; until the table
-- exists those claims fail, the worker returns 500 and QStash retries, so
-- automation emails stop (they are not lost while QStash keeps retrying).
-- The public subscribe route fails open without rate_limits, so signups keep
-- working, but they are not rate limited until it exists.
--
-- Additive and idempotent throughout, so a re-run after a partial failure is
-- safe.

-- ── automation_step_runs ─────────────────────────────────────────────────
-- One row per (automation run, step) whose side effect must not repeat when
-- QStash redelivers a message. See db/schema.ts.
CREATE TABLE IF NOT EXISTS automation_step_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  run_id text NOT NULL,
  node_id text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT automation_step_runs_run_node_unq UNIQUE (run_id, node_id)
);
CREATE INDEX IF NOT EXISTS automation_step_runs_automation_id_idx
  ON automation_step_runs (automation_id);

-- ── rate_limits ──────────────────────────────────────────────────────────
-- Shared fixed-window counters for lib/rate-limit.ts. Identical to the
-- statement in security-accounts.sql (PR #4); whichever runs first creates
-- it and the other is a no-op.
CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  count integer NOT NULL
);

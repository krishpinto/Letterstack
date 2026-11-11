-- Automations, signup forms and unsubscribe fixes.
--
-- Apply BEFORE deploying the code on this branch. The automation worker
-- claims every send and delay step in automation_step_runs; until the table
-- exists those claims fail, the worker returns 500 and QStash retries, so
-- automation emails stop (they are not lost while QStash keeps retrying).
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

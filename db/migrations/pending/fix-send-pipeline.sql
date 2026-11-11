-- fix/send-pipeline: additive columns for atomic per-recipient claims.
-- Idempotent: safe to run more than once. Apply BEFORE deploying the code
-- that reads these columns. The code currently in production never reads or
-- writes them, so applying this first changes nothing for it.

-- When a worker claimed a recipient row (status 'sending').
alter table campaign_recipients add column if not exists claimed_at timestamp;

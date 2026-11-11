-- fix/send-pipeline: additive columns for atomic per-recipient claims.
-- Idempotent: safe to run more than once. Apply BEFORE deploying the code
-- that reads these columns. The code currently in production never reads or
-- writes them, so applying this first changes nothing for it.

-- When a worker claimed a recipient row (status 'sending').
alter table campaign_recipients add column if not exists claimed_at timestamp;

-- When the campaign's current dispatch round (first send or latest Resume)
-- started. Keys QStash deduplication ids and throttles Resume.
alter table campaigns add column if not exists last_dispatched_at timestamp;

-- Why a campaign ended in status 'failed', shown to its owner.
alter table campaigns add column if not exists failure_reason text;

-- Fixed-window counters, first used to cap test sends per user.
create table if not exists rate_limits (
  key text primary key,
  window_start timestamp not null,
  count integer not null
);

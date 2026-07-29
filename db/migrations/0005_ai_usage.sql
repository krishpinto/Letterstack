-- Agent usage ledger and per-user token budgets.
--
-- ai_usage is append-only and doubles as the rate limiter: the global daily,
-- rolling per-minute, and per-user monthly gates are all COUNT/SUM queries over
-- this table, which is why the two indexes below are load-bearing rather than
-- speculative. Failed calls are recorded too — a failed call still spends a
-- request against the provider's daily ceiling.

create table if not exists ai_usage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  provider text not null,
  model text not null,
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  -- No FK: usage history stays meaningful after a campaign is deleted.
  campaign_id uuid,
  ok boolean not null default true,
  error text,
  created_at timestamp not null default now()
);

-- Global daily count and rolling per-minute count.
create index if not exists ai_usage_created_at_idx
  on ai_usage(created_at);

-- Per-user monthly token total.
create index if not exists ai_usage_user_created_at_idx
  on ai_usage(user_id, created_at);

create table if not exists ai_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id) on delete cascade,
  monthly_token_limit integer not null default 200000,
  updated_at timestamp not null default now()
);

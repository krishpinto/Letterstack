-- API keys for the public /api/v1 tree, plus the per-workspace monthly
-- request counter that enforces the plan allowance.
--
-- Apply with: npx tsx scripts/migrate-0008-api-keys.ts
-- (drizzle-kit push still trips over the campaign_recipients drift.)

CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  prefix text NOT NULL,
  last_four text NOT NULL,
  scopes jsonb NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_keys_organization_idx ON api_keys (organization_id);

CREATE TABLE IF NOT EXISTS api_key_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period text NOT NULL,
  requests integer NOT NULL DEFAULT 0,
  CONSTRAINT api_key_usage_org_period_unq UNIQUE (organization_id, period)
);

-- Backing tables and columns for the remaining settings sections.
--
-- Idempotent throughout (IF NOT EXISTS), so a re-run after a partial failure
-- is safe. drizzle-kit push is still unusable on this database: it trips over
-- the campaign_recipients drift and offers to truncate.

-- ── Sending ──────────────────────────────────────────────────────────────
-- Workspace-level sender defaults. Before these, a new campaign's From name
-- fell back to the literal string "LetterStack" (app/api/campaigns/route.ts),
-- which is our brand appearing on a customer's newsletter.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_from_name text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_reply_to text;

-- ── Notifications ────────────────────────────────────────────────────────
-- Per member, per workspace: the same person can want campaign reports for
-- the workspace they run and silence for one they were invited into.
--
-- Absence of a row means "the defaults" (see lib/notifications/preferences.ts)
-- rather than "notifications off", so existing members need no backfill and
-- a new member inherits the defaults without a write at invite time.
CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_finished boolean NOT NULL DEFAULT true,
  deliverability_alerts boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS notification_preferences_user_idx
  ON notification_preferences (user_id);

-- Dedup stamp for the deliverability alert. Bounces arrive asynchronously
-- over SNS long after a campaign finishes sending, so the alert fires from
-- the webhook — which sees one event at a time and would otherwise mail on
-- every bounce past the threshold instead of once per campaign.
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS deliverability_alert_sent_at timestamptz;

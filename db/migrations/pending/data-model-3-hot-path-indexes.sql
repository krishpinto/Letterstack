-- data-model-3: indexes for lookups that scan whole tables today.
--
-- APPLY ORDER
--   3 of 3 for this change set. Any time; the code works without these, just
--   slower. Independent of data-model-1 and data-model-2.
--
--   CREATE INDEX CONCURRENTLY cannot run inside a transaction block. Run
--   this file with psql in its default autocommit mode: NOT with
--   `psql -1` / --single-transaction, and not wrapped in BEGIN/COMMIT. A web
--   SQL editor may wrap a multi-statement script in one transaction; if you
--   see "cannot run inside a transaction block", run each statement alone.
--
-- PURPOSE
--   email_events has no index besides its primary key, yet every analytics
--   read joins it to campaigns on campaign_id and groups by type
--   (campaignEngagement and engagementByOrganization in db/events.ts,
--   dashboardStats and dashboardSeries in db/dashboard.ts). It is also the
--   fastest-growing table: one row per send, delivery, open, click, bounce
--   and complaint (33.8k rows on 2026-11-11).
--     -> email_events (campaign_id, type)
--   Nothing in the app filters email_events by email alone or by created_at
--   alone, except the lab page and the admin monitor, so no index for those.
--
--   campaign_recipients (27.7k rows) is looked up by email alone on every
--   bounce, complaint and unsubscribe (userIdsForEmail,
--   organizationIdsForEmail, suppressionTargetsForEmail in
--   db/campaign-recipients.ts). The unique (campaign_id, email) cannot serve
--   that: email is its second column. The queries compare with plain `=`,
--   so a plain index (not lower(email)) is the one the planner can use.
--     -> campaign_recipients (email)
--
--   campaign_recipients.recipient_id references recipients ON DELETE CASCADE
--   with no index, so deleting one contact scans every campaign recipient
--   row ever written.
--     -> campaign_recipients (recipient_id)
--
--   Uniqueness of contacts and suppressions already exists, so nothing is
--   added for it:
--     recipients_org_email_unq   UNIQUE (organization_id, email)
--     suppressed_org_email_unq   UNIQUE (organization_id, email)
--   Checked on a branch of production on 2026-11-11: no duplicates, not
--   even case-insensitive ones (lower(email)) within a workspace.
--
-- SAFE TO RUN ON LIVE DATA?
--   Yes. CREATE INDEX CONCURRENTLY does not block reads or writes.
--
--   If a concurrent build fails or is cancelled it leaves an INVALID index
--   behind under the same name, and IF NOT EXISTS then skips it on a re-run.
--   Check with the query at the bottom; DROP INDEX CONCURRENTLY any invalid
--   one and run its CREATE again.
--
-- EXPECTED LOCK / TIME
--   No blocking lock. Each build makes two passes over its table; at these
--   sizes that is a few seconds each. Writes keep working throughout. Each
--   index adds a little work to every insert into its table.
--
-- ROLLBACK
--   DROP INDEX CONCURRENTLY IF EXISTS email_events_campaign_id_type_idx;
--   DROP INDEX CONCURRENTLY IF EXISTS campaign_recipients_email_idx;
--   DROP INDEX CONCURRENTLY IF EXISTS campaign_recipients_recipient_id_idx;

CREATE INDEX CONCURRENTLY IF NOT EXISTS email_events_campaign_id_type_idx
  ON email_events (campaign_id, type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS campaign_recipients_email_idx
  ON campaign_recipients (email);

CREATE INDEX CONCURRENTLY IF NOT EXISTS campaign_recipients_recipient_id_idx
  ON campaign_recipients (recipient_id);

-- ── Check (read-only): all three listed, indisvalid = true.
--
-- SELECT c.relname AS index_name, i.indisvalid
-- FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
-- WHERE c.relname IN ('email_events_campaign_id_type_idx',
--                     'campaign_recipients_email_idx',
--                     'campaign_recipients_recipient_id_idx');

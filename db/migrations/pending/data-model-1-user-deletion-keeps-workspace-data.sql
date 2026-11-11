-- data-model-1: deleting a user account must not delete workspace data.
--
-- APPLY ORDER
--   1 of 3 for this change set. Apply before deploying the code. Order
--   relative to the other data-model files does not matter; each is
--   independent.
--
-- PURPOSE
--   Every org-scoped table's user_id was ON DELETE CASCADE. So one member
--   deleting their account silently deleted the contacts, campaigns, signup
--   forms, automations and API keys they had created in workspaces they
--   don't own, plus their payments (and through those, invoices) and their
--   suppression rows - which made bounced and complained addresses mailable
--   again.
--
--   deleteUserAccount (db/users.ts) now hands contacts, campaigns, forms,
--   automations and API keys to the workspace owner before it deletes the
--   user. Payments and suppression rows are kept by the SET NULL below, so
--   they depend on this file. It is also the backstop, so no future code
--   path can cascade any of them away:
--
--   RESTRICT - deleting a user who still owns such rows fails loudly:
--     recipients.user_id, campaigns.user_id, signup_forms.user_id,
--     automations.user_id, api_keys.created_by_user_id
--
--   SET NULL - the row survives, it just no longer names the person:
--     payments.user_id          (who paid; a payment is a financial record)
--     suppressed_emails.user_id (who added it; the suppression must stay)
--     users.access_decided_by_user_id (was NO ACTION, which blocked deleting
--       any admin who had ever approved an early-access account)
--   payments.user_id and suppressed_emails.user_id become nullable.
--
--   Left as CASCADE on purpose (personal to the user, meaningless without
--   them): password_resets, organization_members, notification_preferences,
--   connected_mailboxes (a personal Gmail credential), ai_budgets, ai_usage,
--   organization_invites.invited_by_user_id.
--
--   Constraint names do not change. Each FK is dropped and re-added under
--   the name it already has, which is the name db/schema.ts declares.
--
-- SAFE TO RUN ON LIVE DATA?
--   Yes. No rows change. Idempotent: a re-run drops and re-adds the same
--   constraints with the same actions.
--
--   Deploy note: with this applied and the OLD code still running, deleting
--   a member who created any of the RESTRICT rows fails with an error
--   instead of deleting those rows. That is the intended direction of
--   failure. Deploy the new db/users.ts soon after.
--
-- EXPECTED LOCK / TIME
--   One transaction. Per table, DROP CONSTRAINT takes ACCESS EXCLUSIVE on
--   that table and on users for the length of the swap, and re-adding the
--   FK scans the table once to validate it. Sizes on 2026-11-11: recipients
--   3.6k rows, campaigns 57, the others smaller. Well under a second.
--   lock_timeout makes it fail fast rather than queue behind a long query;
--   if it times out, run it again.
--
-- ROLLBACK
--   Run the DO block again with every action set to CASCADE (and
--   access_decided_by_user_id to NO ACTION), then:
--     ALTER TABLE payments ALTER COLUMN user_id SET NOT NULL;
--     ALTER TABLE suppressed_emails ALTER COLUMN user_id SET NOT NULL;
--   SET NOT NULL fails if a user was deleted in between and nulled rows -
--   those rows are exactly what this change exists to keep.

SET lock_timeout = '5s';

BEGIN;

ALTER TABLE payments ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE suppressed_emails ALTER COLUMN user_id DROP NOT NULL;

DO $$
DECLARE
  spec record;
  fk_name text;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('recipients',        'user_id',                   'RESTRICT'),
      ('campaigns',         'user_id',                   'RESTRICT'),
      ('signup_forms',      'user_id',                   'RESTRICT'),
      ('automations',       'user_id',                   'RESTRICT'),
      ('api_keys',          'created_by_user_id',        'RESTRICT'),
      ('payments',          'user_id',                   'SET NULL'),
      ('suppressed_emails', 'user_id',                   'SET NULL'),
      ('users',             'access_decided_by_user_id', 'SET NULL')
    ) AS v(tbl, col, on_delete)
  LOOP
    -- The FK that guards this column today, found by column rather than
    -- by name. Exactly one exists for each of these on 2026-11-11.
    SELECT con.conname INTO fk_name
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND cls.relnamespace = 'public'::regnamespace
      AND cls.relname = spec.tbl
      AND array_length(con.conkey, 1) = 1
      AND att.attname = spec.col
      AND con.confrelid = 'public.users'::regclass;

    IF fk_name IS NULL THEN
      RAISE EXCEPTION 'no foreign key on %.% - schema is not what this file expects', spec.tbl, spec.col;
    END IF;

    -- One statement: the column is never left without a constraint.
    EXECUTE format(
      'ALTER TABLE %I DROP CONSTRAINT %I, ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES users(id) ON DELETE %s',
      spec.tbl, fk_name, fk_name, spec.col, spec.on_delete
    );
  END LOOP;
END $$;

COMMIT;

-- ── Check (read-only). confdeltype: a = NO ACTION, r = RESTRICT,
-- c = CASCADE, n = SET NULL. Expect r for the five RESTRICT columns, n for
-- the three SET NULL ones, c for the rest.
--
-- SELECT cls.relname AS table_name, att.attname AS column_name,
--        con.conname, con.confdeltype
-- FROM pg_constraint con
-- JOIN pg_class cls ON cls.oid = con.conrelid
-- JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
-- WHERE con.contype = 'f' AND con.confrelid = 'public.users'::regclass
-- ORDER BY 1, 2;

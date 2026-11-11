-- data-model-2: deleting a workspace keeps its payments, invoices and
-- suppression list.
--
-- APPLY ORDER
--   2 of 3 for this change set. Apply before deploying the code (the code
--   already copes with organization_id being NULL; nothing breaks if this
--   runs first). Independent of data-model-1 and data-model-3.
--
-- PURPOSE
--   payments, invoices and suppressed_emails referenced organizations with
--   ON DELETE CASCADE, so deleting a workspace deleted its financial records
--   and its suppression list. The Terms say suppression records survive
--   termination, and issued invoices must be kept for accounting.
--
--   Design: organization_id on payments, invoices and suppressed_emails
--   becomes nullable with ON DELETE SET NULL, and invoices.payment_id
--   becomes RESTRICT. The rows survive the workspace with no workspace
--   attached. A soft-deleted organization was the alternative; it would
--   need every org-scoped query in the app to learn to skip deleted
--   workspaces, for the benefit of three tables.
--
--   What a kept row still says: an invoice keeps its number, amount,
--   currency, issue date, the address it was emailed to, and its payment
--   (Razorpay order and payment ids, item, amount). It does not keep the
--   buyer's name; see the PR for that decision. A suppression row keeps
--   email + reason with organization_id NULL; sends do not consult those
--   rows (docs/database.md).
--
--   Constraint names do not change: each FK is dropped and re-added under
--   the name it already has, which is the name db/schema.ts declares.
--
-- SAFE TO RUN ON LIVE DATA?
--   Yes. No rows change. Idempotent: a re-run drops and re-adds the same
--   constraints with the same actions, and DROP NOT NULL on a nullable
--   column is a no-op.
--
-- EXPECTED LOCK / TIME
--   One transaction. Per table, DROP CONSTRAINT takes ACCESS EXCLUSIVE on
--   that table and on the referenced table (organizations, payments) for
--   the length of the swap; re-adding validates with one scan. Sizes on
--   2026-11-11: suppressed_emails 276 rows, payments 6, invoices 1. Well
--   under a second. lock_timeout makes it fail fast rather than queue; if
--   it times out, run it again.
--
-- ROLLBACK
--   Run the DO block again with every action set to CASCADE, then:
--     ALTER TABLE payments ALTER COLUMN organization_id SET NOT NULL;
--     ALTER TABLE invoices ALTER COLUMN organization_id SET NOT NULL;
--     ALTER TABLE suppressed_emails ALTER COLUMN organization_id SET NOT NULL;
--   SET NOT NULL fails if a workspace was deleted in between - those rows
--   are what this change exists to keep.

SET lock_timeout = '5s';

BEGIN;

ALTER TABLE payments ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE invoices ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE suppressed_emails ALTER COLUMN organization_id DROP NOT NULL;

DO $$
DECLARE
  spec record;
  fk_name text;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('payments',          'organization_id', 'organizations', 'SET NULL'),
      ('invoices',          'organization_id', 'organizations', 'SET NULL'),
      ('suppressed_emails', 'organization_id', 'organizations', 'SET NULL'),
      ('invoices',          'payment_id',      'payments',      'RESTRICT')
    ) AS v(tbl, col, reftbl, on_delete)
  LOOP
    SELECT con.conname INTO fk_name
    FROM pg_constraint con
    JOIN pg_class cls ON cls.oid = con.conrelid
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND cls.relnamespace = 'public'::regnamespace
      AND cls.relname = spec.tbl
      AND array_length(con.conkey, 1) = 1
      AND att.attname = spec.col
      AND con.confrelid = format('public.%I', spec.reftbl)::regclass;

    IF fk_name IS NULL THEN
      RAISE EXCEPTION 'no foreign key on %.% - schema is not what this file expects', spec.tbl, spec.col;
    END IF;

    EXECUTE format(
      'ALTER TABLE %I DROP CONSTRAINT %I, ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(id) ON DELETE %s',
      spec.tbl, fk_name, fk_name, spec.col, spec.reftbl, spec.on_delete
    );
  END LOOP;
END $$;

COMMIT;

-- ── Check (read-only). confdeltype: n = SET NULL, r = RESTRICT. Expect n for
-- the three organization_id rows and r for invoices.payment_id.
--
-- SELECT cls.relname AS table_name, att.attname AS column_name,
--        con.conname, con.confdeltype
-- FROM pg_constraint con
-- JOIN pg_class cls ON cls.oid = con.conrelid
-- JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
-- WHERE con.contype = 'f'
--   AND cls.relname IN ('payments', 'invoices', 'suppressed_emails')
-- ORDER BY 1, 2;

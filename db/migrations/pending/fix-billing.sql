-- fix/billing: resumable settlement and refund tracking.
--
-- Additive only. Safe to run more than once: every column uses IF NOT EXISTS
-- and every backfill only touches rows it has not already filled.
--
-- Order of operations:
--   1. Run this whole file BEFORE deploying the fix/billing code. The new
--      code selects these columns, so every payments query fails without them.
--   2. Deploy.
--   3. Run this whole file AGAIN right after the deploy finishes. Any payment
--      the old code settled in between was granted its plan without setting
--      plan_granted_at; the second run marks it, so a later webhook retry
--      cannot grant it a second time.

ALTER TABLE payments ADD COLUMN IF NOT EXISTS plan_granted_at timestamp;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS plan_granted_plan text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS plan_granted_days integer;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_refunded integer NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_at timestamp;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS plan_revoked_at timestamp;

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS email_claimed_at timestamp;

-- Backfill: every payment already marked paid was settled by the old code,
-- which granted the plan in the same pass. Mark the grant as done so the new
-- settlement never re-applies it. Days and tier come from the catalog
-- (lib/payments/catalog.ts) as it stood when those payments were taken.
UPDATE payments
SET plan_granted_at = COALESCE(paid_at, created_at),
    plan_granted_plan = CASE item
      WHEN 'pro_monthly' THEN 'pro'
      WHEN 'pro_yearly' THEN 'pro'
      WHEN 'pro_smoke_test' THEN 'pro'
      WHEN 'growth_monthly' THEN 'growth'
      WHEN 'growth_yearly' THEN 'growth'
      ELSE NULL
    END,
    plan_granted_days = CASE item
      WHEN 'pro_monthly' THEN 30
      WHEN 'pro_yearly' THEN 365
      WHEN 'pro_smoke_test' THEN 30
      WHEN 'growth_monthly' THEN 30
      WHEN 'growth_yearly' THEN 365
      ELSE 0
    END
WHERE status = 'paid' AND plan_granted_at IS NULL;

-- Invoices that already went out are not to be mailed again.
UPDATE invoices
SET email_claimed_at = sent_at
WHERE sent_at IS NOT NULL AND email_claimed_at IS NULL;

-- Read-only check, worth running once by hand: paid payments whose workspace
-- is not on a running paid plan today. Before this fix a failed grant left a
-- customer charged and on Free, and the backfill above marks those payments
-- as granted too — so look at each row here and fix it by hand (admin grant
-- or refund). Expect rows for periods that simply ran out; compare paid_at
-- with the plan length.
--
-- SELECT p.id, p.razorpay_order_id, p.item, p.amount, p.paid_at,
--        o.id AS organization_id, o.name, o.plan, o.plan_source, o.plan_expires_at
-- FROM payments p
-- JOIN organizations o ON o.id = p.organization_id
-- WHERE p.status = 'paid'
--   AND p.item <> 'internal_test'
--   AND (o.plan = 'free' OR (o.plan_expires_at IS NOT NULL AND o.plan_expires_at <= now()))
-- ORDER BY p.paid_at DESC;

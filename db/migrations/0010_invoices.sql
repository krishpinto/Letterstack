-- Issued invoices.
--
-- Idempotent (IF NOT EXISTS), so a re-run after a partial failure is safe.
-- drizzle-kit push is still unusable on this database: it trips over the
-- campaign_recipients drift and offers to truncate.

-- One row per invoice actually issued. Until this existed the serial on the
-- PDF was computed on the fly, which meant every render produced "0001" and
-- nothing recorded that a document had been sent to anybody.
--
-- The serial is stored in parts rather than only as the formatted string, so
-- "the next number for this financial year" is a MAX() over an integer column
-- instead of parsing text back out of LS/2026-27/0001.
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- The payment this invoices. Unique: settlement can run twice (the browser
  -- callback and the webhook race, and the webhook retries), and the second
  -- pass must find the existing invoice rather than issue a second one with a
  -- fresh serial.
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  -- Indian financial year, April to March, as "2026-27". Serials restart each
  -- year, which is what an accountant expects to see.
  financial_year text NOT NULL,
  sequence integer NOT NULL,
  -- The formatted serial, stored so a reissue of an old invoice can never
  -- render a different string than the one the customer already has.
  number text NOT NULL,
  -- Paise, matching payments.amount: no float ever touches money here.
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  issued_at timestamp NOT NULL DEFAULT now(),
  -- Where it went and when, so "did they get it?" is answerable without
  -- digging through SES logs. Null until the email actually goes out.
  sent_to text,
  sent_at timestamp,
  ses_message_id text
);

CREATE UNIQUE INDEX IF NOT EXISTS invoices_payment_unq ON invoices (payment_id);
-- Two invoices can never share a serial within a financial year. This is the
-- backstop for the allocate-then-insert race: concurrent settlements both read
-- the same MAX(), one insert wins, the loser retries with the next number.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_serial_unq
  ON invoices (financial_year, sequence);
CREATE INDEX IF NOT EXISTS invoices_organization_idx ON invoices (organization_id);

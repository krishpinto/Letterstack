-- Beta send-cap tracking: total marketing emails ever sent per org.
-- Purely additive; applied via scripts/add-emails-sent-count.ts.

alter table organizations
  add column if not exists emails_sent_count integer not null default 0;

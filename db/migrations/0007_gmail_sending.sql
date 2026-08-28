-- Gmail sending: a personal Gmail account connected via OAuth, usable as an
-- alternative sending channel alongside SES domains. See the Gmail Sending
-- plan and context/gmail-sending-plan.md for the full design.

create table connected_mailboxes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  provider text not null default 'gmail',
  email text not null,
  display_name text,
  refresh_token_ciphertext text not null,
  refresh_token_iv text not null,
  refresh_token_tag text not null,
  access_token text,
  access_token_expires_at timestamptz,
  scope text not null,
  daily_limit integer not null default 450,
  sent_today integer not null default 0,
  quota_reset_at timestamptz not null default now(),
  status text not null default 'active',
  last_error text,
  created_at timestamptz not null default now(),
  constraint connected_mailboxes_org_email_unq unique (organization_id, email)
);

alter table campaigns add column reply_to text;
alter table campaigns add column sender_type text not null default 'shared';
alter table campaigns add column mailbox_id uuid references connected_mailboxes(id) on delete set null;

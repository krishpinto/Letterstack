-- Pending invites to join an organization by email. Purely additive.

create table if not exists organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text not null default 'member',
  invited_by_user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamp not null,
  accepted_at timestamp,
  created_at timestamp not null default now()
);

create index if not exists organization_invites_org_email_idx
  on organization_invites(organization_id, email);

-- Production-safe migration for the organization-first LetterStack flow.
--
-- Existing data is preserved:
-- - every existing user gets one default organization
-- - existing campaigns attach to that organization
-- - existing suppressions become organization-scoped
-- - existing draft campaigns receive a private copy of the user's current
--   global recipients as their campaign audience

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'business',
  created_at timestamp not null default now()
);

create table if not exists organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamp not null default now(),
  constraint organization_members_org_user_unq unique (organization_id, user_id)
);

create index if not exists organization_members_user_id_idx
  on organization_members(user_id);

create table if not exists _letterstack_org_backfill (
  user_id uuid primary key,
  organization_id uuid not null,
  name text not null
);

truncate table _letterstack_org_backfill;

insert into _letterstack_org_backfill (user_id, organization_id, name)
select
  u.id,
  gen_random_uuid(),
  coalesce(nullif(trim(u.name), ''), split_part(u.email, '@', 1), 'LetterStack') || '''s organization'
from users u
where not exists (
  select 1
  from organization_members om
  where om.user_id = u.id
)
on conflict (user_id) do nothing;

insert into organizations (id, name, type)
select organization_id, name, 'business'
from _letterstack_org_backfill
on conflict (id) do nothing;

insert into organization_members (organization_id, user_id, role)
select organization_id, user_id, 'owner'
from _letterstack_org_backfill
on conflict on constraint organization_members_org_user_unq do nothing;

drop table if exists _letterstack_org_backfill;

alter table campaigns add column if not exists organization_id uuid;

with fallback_owner as (
  select user_id, organization_id
  from organization_members
  order by created_at asc
  limit 1
)
update campaigns c
set user_id = fallback_owner.user_id
from fallback_owner
where c.user_id is null;

with first_org as (
  select distinct on (user_id) user_id, organization_id
  from organization_members
  order by user_id, created_at asc
)
update campaigns c
set organization_id = first_org.organization_id
from first_org
where c.user_id = first_org.user_id
  and c.organization_id is null;

alter table campaigns alter column organization_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'campaigns_organization_id_organizations_id_fk'
  ) then
    alter table campaigns
      add constraint campaigns_organization_id_organizations_id_fk
      foreign key (organization_id) references organizations(id) on delete cascade;
  end if;
end $$;

create index if not exists campaigns_organization_id_idx
  on campaigns(organization_id);

alter table suppressed_emails add column if not exists organization_id uuid;

with first_org as (
  select distinct on (user_id) user_id, organization_id
  from organization_members
  order by user_id, created_at asc
)
update suppressed_emails se
set organization_id = first_org.organization_id
from first_org
where se.user_id = first_org.user_id
  and se.organization_id is null;

alter table suppressed_emails alter column organization_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'suppressed_emails_organization_id_organizations_id_fk'
  ) then
    alter table suppressed_emails
      add constraint suppressed_emails_organization_id_organizations_id_fk
      foreign key (organization_id) references organizations(id) on delete cascade;
  end if;
end $$;

alter table suppressed_emails drop constraint if exists suppressed_user_email_unq;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'suppressed_org_email_unq'
  ) then
    alter table suppressed_emails
      add constraint suppressed_org_email_unq unique (organization_id, email);
  end if;
end $$;

create index if not exists suppressed_emails_organization_id_idx
  on suppressed_emails(organization_id);

alter table campaign_recipients add column if not exists name text;

update campaign_recipients cr
set name = r.name
from recipients r
where cr.recipient_id = r.id
  and cr.name is null;

alter table campaign_recipients alter column recipient_id drop not null;

insert into campaign_recipients (campaign_id, recipient_id, email, name, status)
select c.id, r.id, r.email, r.name, 'pending'
from campaigns c
join recipients r on r.user_id = c.user_id
left join suppressed_emails se
  on se.organization_id = c.organization_id
 and se.email = r.email
where c.status = 'draft'
  and se.id is null
  and not exists (
    select 1
    from campaign_recipients cr
    where cr.campaign_id = c.id
      and cr.email = r.email
  );

delete from campaign_recipients a
using campaign_recipients b
where a.campaign_id = b.campaign_id
  and a.email = b.email
  and a.ctid < b.ctid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'campaign_recipients_campaign_email_unq'
  ) then
    alter table campaign_recipients
      add constraint campaign_recipients_campaign_email_unq unique (campaign_id, email);
  end if;
end $$;

create index if not exists campaign_recipients_campaign_id_idx
  on campaign_recipients(campaign_id);

-- Promote the legacy user contact list into an organization-owned audience.
-- Existing contacts are preserved and attached to the user's first organization.

alter table recipients add column if not exists organization_id uuid;

with first_org as (
  select distinct on (user_id) user_id, organization_id
  from organization_members
  order by user_id, created_at asc
)
update recipients r
set organization_id = first_org.organization_id
from first_org
where r.user_id = first_org.user_id
  and r.organization_id is null;

with fallback_owner as (
  select user_id, organization_id
  from organization_members
  order by created_at asc
  limit 1
)
update recipients r
set
  user_id = fallback_owner.user_id,
  organization_id = fallback_owner.organization_id
from fallback_owner
where r.organization_id is null;

update recipients
set email = lower(trim(email));

alter table recipients alter column organization_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'recipients_organization_id_organizations_id_fk'
  ) then
    alter table recipients
      add constraint recipients_organization_id_organizations_id_fk
      foreign key (organization_id) references organizations(id) on delete cascade;
  end if;
end $$;

with ranked as (
  select
    id,
    first_value(id) over (
      partition by organization_id, email
      order by created_at asc, id asc
    ) as keep_id,
    row_number() over (
      partition by organization_id, email
      order by created_at asc, id asc
    ) as row_number
  from recipients
)
update campaign_recipients cr
set recipient_id = ranked.keep_id
from ranked
where ranked.row_number > 1
  and cr.recipient_id = ranked.id;

with ranked as (
  select
    id,
    row_number() over (
      partition by organization_id, email
      order by created_at asc, id asc
    ) as row_number
  from recipients
)
delete from recipients r
using ranked
where ranked.row_number > 1
  and r.id = ranked.id;

alter table recipients drop constraint if exists recipients_user_email_unq;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'recipients_org_email_unq'
  ) then
    alter table recipients
      add constraint recipients_org_email_unq unique (organization_id, email);
  end if;
end $$;

create index if not exists recipients_organization_id_idx
  on recipients(organization_id);
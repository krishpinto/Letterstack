-- Early-access waitlist gate. New signups default to 'pending'; existing
-- accounts (including the first customer's) are grandfathered to 'approved' so
-- nothing regresses for current users.

alter table users add column access_status text not null default 'pending';
alter table users add column access_decided_at timestamptz;
alter table users add column access_decided_by_user_id uuid references users(id);
alter table users add column waitlist_applied_email_sent_at timestamptz;

update users set access_status = 'approved', access_decided_at = now();

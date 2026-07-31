# Data Model

The current product model is organization-first, with an organization Audience
library and a frozen audience snapshot per campaign.

## Tables

`users`
- Login identity.
- Owns auth details and account-level sending slug.
- Early-access gate (`context/early-access-plan.md`, migration
  `0006_early_access.sql`): `access_status` (`pending`/`approved`/`rejected`,
  default `pending`; every row that existed before the migration was
  backfilled to `approved`), `access_decided_at`, `access_decided_by_user_id`,
  and `waitlist_applied_email_sent_at` (guards the "you're on the list"
  email against being sent twice — see `app/(auth)/early-access/page.tsx`).
  Checked in `proxy.ts`, not in a page layout — see `user-flow.md`.

`organizations`
- Workspace/account created during onboarding or from the dashboard sidebar.
- Has `name` and `type`, where type is `personal` or `business`.

`organization_members`
- Joins users to organizations.
- Multiple organizations can be created through `POST /api/organizations`.
- The active organization is stored outside the DB in the HttpOnly
  `letterstack_active_organization_id` cookie and verified against this table.

`recipients`
- The reusable Audience library for one organization.
- Stores `organization_id`, creator/importer `user_id`, email, name, and timestamps.
- Unique by `(organization_id, email)`.
- CSV and Excel imports write here.

`campaigns`
- Belongs to `organization_id`.
- Also keeps `user_id` for creator/legacy ownership.
- Stores subject, from name/email, `document`, frozen HTML/text snapshots, status, timestamps.

`campaign_recipients`
- The frozen audience snapshot for one campaign.
- Stores `campaign_id`, optional source `recipient_id`, email, name, status,
  sent timestamp, and error.
- Unique by `(campaign_id, email)`.
- Contacts can be copied from the organization Audience or added/imported only
  for that campaign.

`suppressed_emails`
- Organization-wide do-not-mail list.
- Stores `organization_id`, `user_id`, email, reason.
- Unique by `(organization_id, email)`.
- Reasons include `unsubscribe`, `bounce`, `complaint`, and `manual`.

`email_events`
- SES/SNS event log.
- Stores email, event type, optional campaign id, timestamp.

## Main Relationship

```text
users
  -> organization_members
      -> organizations
          -> recipients (organization Audience)
          -> campaigns
              -> campaign_recipients (frozen campaign snapshot)
          -> suppressed_emails
          -> email_events via campaigns.id
```

## Current Source Of Truth

- Active organization: `letterstack_active_organization_id` cookie, verified via
  `organization_members`.
- Organization Audience library: `recipients` scoped by `organization_id`.
- Campaign list and analytics: `campaigns` scoped by organization.
- Campaign send audience: `campaign_recipients`.
- Send safety: `suppressed_emails` scoped by organization.
- Engagement analytics: `email_events`.
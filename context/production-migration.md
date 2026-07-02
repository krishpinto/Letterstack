# Production Migration Notes

The production database has existing data. Schema changes must be applied in a
backward-compatible order.

## Migrations

`db/migrations/0001_organizations_campaign_audience.sql`

- creates organizations and memberships
- attaches campaigns and suppressions to organizations
- establishes campaign-owned recipient snapshots

`db/migrations/0002_organization_audience.sql`

- adds `recipients.organization_id`
- attaches existing contacts to each user's first organization
- normalizes and deduplicates email addresses by organization
- repoints campaign recipient source ids before deleting duplicates
- changes uniqueness from `(user_id, email)` to `(organization_id, email)`

The migration runner applies numbered SQL files in order and creates a JSON
backup before changing production.

## Current Production Verification

Applied on 2026-06-23:

- users: 3
- organizations: 3
- organization members: 3
- audience contacts: 3
- audience contacts missing organization: 0
- campaigns: 8
- campaigns missing organization: 0

Backup:

`db/backups/letterstack-db-backup-2026-06-23T15-08-25-279Z.json`

## Deploy Checks

1. Verify `/dashboard/audience` loads organization contacts.
2. Import a small CSV or Excel sheet.
3. Create a draft campaign and use **Add org audience**.
4. Confirm campaign recipients are copied, not dynamically linked.
5. Verify suppressed addresses are excluded.
6. Send a test and confirm production send still uses `campaign_recipients`.
# Mail System

Canonical current-code reference for LetterStack sending, delivery events, suppression, unsubscribe, and analytics.

Last reconciled with the working tree: **2026-06-23**.

## Current Ownership Model

- A campaign belongs to an organization and records its creating user.
- A campaign's audience lives directly in `campaign_recipients`.
- The old `recipients` table is legacy compatibility data, not the source for new campaign sends.
- Suppression is organization-wide through `suppressed_emails`.

This supersedes the old handoff's user-global recipient model.

## File And Folder Map

### Send orchestration

- `lib/send/send-campaign.ts`
  - `startCampaign(campaignId)` prepares pending recipients, marks the campaign `sending`, chunks the audience, and publishes QStash jobs.
  - `sendCampaignBatch(...)` rechecks suppression, personalizes unsubscribe links, sends through SES, and marks each ledger row `sent` or `failed`.
  - `BATCH_SIZE` is currently `2` for testing, not production throughput.
- `lib/send/ses.ts`: `sendEmail()` is the single SES `SendEmailCommand` call. It sets the configuration set, campaign tags, HTML/text bodies, and RFC 8058 unsubscribe headers.
- `lib/send/qstash.ts`: QStash client, local availability check, JSON publishing, and callback base URL.
- `lib/send/sender-identity.ts`: produces `newsletter@<slug>.<MAIL_FROM domain>` sender addresses.

### Trigger and worker routes

- `POST /api/campaigns/[id]/send` in `app/api/campaigns/[id]/send/route.ts`: authenticates, verifies campaign ownership and draft status, then calls `startCampaign(id)`.
- `POST /api/send/campaign-worker` in `app/api/send/campaign-worker/route.ts`: verifies the QStash signature, loads only pending rows, calls `sendCampaignBatch()`, and marks the campaign sent when none remain pending.
- `POST /api/campaigns/[id]/test` in `app/api/campaigns/[id]/test/route.ts`: sends directly through SES to at most five addresses without changing the campaign ledger.

### Audience and ledger

- `db/campaign-recipients.ts`
  - `prepareCampaignAudience()` returns pending non-suppressed rows and marks suppressed pending rows failed.
  - `listPendingByIds()` is the worker retry/idempotency gate.
  - `markCampaignRecipient()` records `sent` or `failed`.
  - `campaignProgress()` powers the live monitor.
  - `suppressionTargetsForEmail()` maps an SES bounce/complaint to organization/user suppression targets.
- `GET|POST|DELETE /api/audience`: organization Audience management.
- `POST /api/audience/import`: CSV/Excel contact import.
- `app/api/campaigns/[id]/recipients/`: campaign-specific add, list, delete, file import, and organization-Audience copy endpoints.

### Delivery events and analytics

- `POST /api/webhooks/ses` in `app/api/webhooks/ses/route.ts`: accepts SNS-wrapped or direct SES event JSON, appends the event, and suppresses bounce/complaint addresses for matching organizations.
- `db/events.ts`: `recordEvent()`, `campaignEngagement()`, and `engagementByOrganization()`.
- `GET /api/analytics` and `GET /api/campaigns/[id]/analytics`: organization overview and per-campaign analytics.

### Suppression and unsubscribe

- `db/suppression.ts`: organization-scoped helpers are canonical; user wrappers resolve the default organization.
- `lib/email/unsubscribe.ts`: signs/verifies tokens and replaces `{{unsubscribe_url}}` at send time.
- `GET|POST /api/unsubscribe`: GET verifies only; POST writes an `unsubscribe` suppression. GET must never suppress because mail scanners prefetch links.
- `app/unsubscribe/`: public confirmation UI.

### Content boundary

- `lib/email/document.ts` defines `EmailDocument`.
- `lib/email/compiler.ts` owns `compileEmailDocument()`.
- Campaign drafts store the editable document plus compiled `html_snapshot` and `text_snapshot`; sends use those snapshots.
- The editor must not construct a separate mail representation.

## End-To-End Send Flow

```text
draft campaign + pending campaign_recipients
-> POST /api/campaigns/[id]/send
-> startCampaign()
-> prepareCampaignAudience(campaignId, organizationId)
-> campaign status = sending
-> QStash publishes one job per batch
-> POST /api/send/campaign-worker
-> verify Upstash signature
-> listPendingByIds()
-> sendCampaignBatch()
-> suppression recheck
-> personalize unsubscribe URL
-> SES sendEmail()
-> campaign_recipient = sent or failed
-> no pending rows remain
-> campaign status = sent
```

QStash retries reload only rows still marked `pending`. A crash after SES accepts a message but before success is recorded remains a narrow duplicate-send risk.

## SES Event Flow

```text
SES configuration set
-> SNS topic
-> POST /api/webhooks/ses
-> campaignId from SES mail tag
-> email_events append
-> Bounce or Complaint
-> suppressionTargetsForEmail()
-> suppressed_emails insert per matching organization
```

`email_events` is append-only. Delivery, bounce, and complaint are hard events. Open and click data are estimates because privacy tooling can block or prefetch tracking.

## Required Environment

- `DATABASE_URL`
- `AUTH_SECRET`
- `UNSUBSCRIBE_SECRET` optional; falls back to `AUTH_SECRET`
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- `SES_CONFIGURATION_SET`, `MAIL_FROM`
- `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`
- `QSTASH_URL` for local QStash only
- `APP_URL` when callback auto-detection is unsuitable

Local queue command: `npm run qstash:dev`.

## Current Risks And Deliberate Debt

- SNS signature verification is not implemented in `app/api/webhooks/ses/route.ts`; the public webhook is spoofable until fixed.
- `BATCH_SIZE = 2` must be reviewed before a real send.
- A campaign is marked `sent` once no rows remain pending, even if some failed.
- `email_events.campaign_id` has no database foreign key in `db/schema.ts`.
- Unsubscribe tokens identify `userId + email`; suppression resolves the user's default organization. Revisit this when users can actively send from multiple organizations.
- New work should use the campaign worker and `campaign_recipients`, not the historical global-recipient send path.

## Change Checklist

1. Update this file and `send-analytics.md` when mail behavior changes.
2. Update `data-model.md` for schema or ownership changes.
3. Update `user-flow.md` for route/UI changes.
4. Add or update a migration for production schema changes.
5. Re-index codebase-memory-mcp.

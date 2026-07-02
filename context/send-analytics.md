# Send And Analytics

LetterStack sends email through Amazon SES and queues campaign work with QStash.

Last reconciled with the working tree: **2026-06-23**. See
`context/mail-system.md` for the exact file, route, and function map.

## Send Flow

```text
draft campaign
-> campaign has pending campaign_recipients
-> POST /api/campaigns/[id]/send
-> startCampaign()
-> prepareCampaignAudience()
-> mark campaign sending
-> enqueue QStash batches
-> /api/send/campaign-worker
-> sendCampaignBatch()
-> mark each campaign_recipient sent or failed
-> mark campaign sent when no pending rows remain
```

Key files:

- `lib/send/send-campaign.ts`
- `lib/send/ses.ts`
- `lib/send/qstash.ts`
- `app/api/send/campaign-worker/route.ts`
- `db/campaign-recipients.ts`

Deprecated global-recipient send routes:

- `POST /api/campaigns/send-now` returns 410.
- `POST /api/lab/send-campaign` returns 410.
- `POST /api/send/worker` verifies QStash and then returns 410.

New sends must use campaign-specific `campaign_recipients`.

`BATCH_SIZE` is currently `2` in `lib/send/send-campaign.ts` for testing and
must be reviewed before production-volume sends.

## Idempotency

Workers only load rows where `campaign_recipients.status = 'pending'`.
QStash retries should not double-send already marked rows. A narrow duplicate
risk remains if SES accepts a message and the worker dies before recording
success.

## Suppression

Suppression is organization-wide.

- Before sending, `prepareCampaignAudience()` filters suppressed addresses.
- During each batch, `sendCampaignBatch()` checks suppression again.
- Unsubscribes call `suppressEmail()`.
- SES bounces and complaints call `suppressEmailForOrganization()`.

## SES Events

SES events arrive through:

```text
SES configuration set
-> SNS
-> POST /api/webhooks/ses
-> db/events.ts recordEvent()
```

Campaign attribution uses the SES `campaignId` tag set in `sendEmail()`.

The webhook currently does not verify SNS signatures. Treat this as a production
blocker because forged requests can create events and suppress addresses.

## Metrics

Hard numbers:

- Delivery
- Bounce
- Complaint
- Sent/failed/pending recipient outcome

Estimated numbers:

- Opens
- Clicks

Privacy clients can block or pre-fetch open/click tracking, so UI copy should
not present opens/clicks as equally reliable.

## Reputation Thresholds

SES reputation safety matters:

- Bounce rate danger: greater than 10 percent.
- Complaint rate danger: greater than 0.5 percent.

Dashboard analytics should eventually show explicit bounce and complaint rates,
not only raw counts.

## Completion Semantics

The campaign worker marks a campaign `sent` when pending reaches zero. This can
include a mixture of sent and failed recipients; `campaignProgress()` carries
the outcome split.

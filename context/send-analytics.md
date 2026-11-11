# Send And Analytics

LetterStack sends email through Amazon SES and queues campaign work with QStash.

Last reconciled with the working tree: **2026-06-23**. See
`context/mail-system.md` for the exact file, route, and function map.

## Send Flow

```text
draft campaign
-> campaign has pending campaign_recipients
-> POST /api/campaigns/[id]/send
-> dispatchCampaign()
-> reserve quota, then claim the campaign (draft|scheduled|failed -> sending)
-> enqueue QStash batches of 50, 4s apart, with deduplication ids
-> /api/send/campaign-worker
-> sendCampaignBatch(): claim each row pending -> sending, then send
-> mark each campaign_recipient sent or failed (or back to pending on throttling)
-> mark campaign sent (or failed) when no pending or sending rows remain
```

Key files:

- `lib/send/send-campaign.ts`
- `lib/send/ses.ts`
- `lib/send/qstash.ts`
- `app/api/send/campaign-worker/route.ts`
- `db/campaign-recipients.ts`

Deprecated global-recipient send routes:

- `POST /api/lab/send-campaign` returns 410.

New sends must use campaign-specific `campaign_recipients`.

## Idempotency

Workers send to a row only after claiming it (`pending` to `sending` in one
guarded UPDATE), so QStash retries, duplicate deliveries and Resume do not
double-send. A row a dead worker left in `sending` is settled after 15 minutes
without being re-sent: `sent` if SES reported an event for it, otherwise
`failed` with "unknown delivery state".

## Suppression

Suppression is organization-wide.

- Before sending, `readSendableAudience()` filters suppressed addresses; they are not reserved and are marked failed once the send is claimed.
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
## Dashboard Analytics UI

`app/dashboard/analytics/page.tsx` filters campaign rows by `sentAt`. For relative windows (`7d`, `30d`, `90d`, `6m`, `1y`), chart series are aggregated into local-day buckets and prefilled with zero-value days across the full selected range. The default route filter is ``7d``. This keeps sparse windows, such as Last 7 days with only one sent campaign, from collapsing to a single x-axis point.

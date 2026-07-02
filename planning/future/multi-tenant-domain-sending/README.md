# Future Plan: Multi-User Accounts, Custom Domains, and SES Sending

## Purpose

This document describes the later-phase plan for turning LetterStack from a
single-client newsletter tool into a multi-user, multi-organization email
platform where customers can connect their own domains and send emails through
LetterStack's Amazon SES account.

This is not part of the current MVP. Current priority remains: one real CIBA
campaign sent successfully.

## Target Model

LetterStack will use an organization-based multi-tenant model.

- A user can belong to one or more organizations.
- An organization owns campaigns, templates, recipients, domains, sender
  addresses, suppression data, and usage.
- An organization can connect multiple custom domains.
- Each custom domain can have multiple sender addresses.
- LetterStack sends emails through its own SES account and charges customers
  for sent email volume.

Customers do not bring their own AWS credentials in the first version.

## Current State

The current app is not multi-tenant yet.

Current behavior:

- One shared send path.
- One global `MAIL_FROM`.
- Campaigns store frozen HTML/text snapshots.
- Recipients are global.
- Suppressions are global.
- SES sends through one configured AWS account.
- QStash handles batching.
- Workers mark recipient status after send.

This is a good base, but it needs tenant ownership and domain verification
before multiple customers can safely use it.

## Future Data Model

Add the following concepts.

### Users

Stores login accounts.

Fields to plan for:

- `id`
- `email`
- `name`
- `createdAt`
- `updatedAt`

### Organizations

Workspaces that own product data.

Fields to plan for:

- `id`
- `name`
- `slug`
- `createdAt`
- `updatedAt`

### Organization Members

Connect users to organizations.

Fields to plan for:

- `id`
- `organizationId`
- `userId`
- `role`

Roles:

- `owner`
- `admin`
- `member`

### Domains

A domain connected by an organization.

Example: `example.com`

Fields to plan for:

- `id`
- `organizationId`
- `domain`
- `status`
- `awsRegion`
- `sesIdentityArn`
- `dkimRecordsJson`
- `mailFromSubdomain`
- `mailFromStatus`
- `trackingSubdomain`
- `trackingStatus`
- `createdAt`
- `verifiedAt`

Statuses:

- `pending`
- `verified`
- `failed`
- `disabled`

### Sender Addresses

Email addresses users can send from.

Examples:

- `newsletter@example.com`
- `updates@example.com`
- `events@example.com`

Fields to plan for:

- `id`
- `organizationId`
- `domainId`
- `email`
- `displayName`
- `isDefault`
- `status`
- `createdAt`

A sender address must belong to a verified domain.

### Campaigns

Campaigns must become organization-scoped.

Add:

- `organizationId`
- `domainId`
- `senderAddressId`
- frozen `fromName`
- frozen `fromEmail`

The frozen sender fields matter because a sent campaign must preserve exactly
who it was sent from, even if the sender address changes later.

### Recipients

Recipients should become organization-scoped.

Add:

- `organizationId`

Later, recipients may belong to lists or audiences.

### Suppression

In early MVP, suppression is global. For multi-tenant use, suppression should
support both:

- Global suppression: hard bounces or complaints that should never be mailed by
  LetterStack.
- Organization suppression: unsubscribes or manual blocks specific to one
  organization.

Suggested fields:

- `id`
- `organizationId` nullable
- `email`
- `reason`
- `scope`
- `createdAt`

Scopes:

- `global`
- `organization`

### Email Events

Events should be tied back to organization, domain, campaign, and recipient
where possible.

Add:

- `organizationId`
- `campaignId`
- `domainId`
- `campaignRecipientId`
- `sesMessageId`
- `email`
- `type`
- `payloadJson`
- `createdAt`

### Usage Ledger

Needed for billing later.

Fields to plan for:

- `id`
- `organizationId`
- `campaignId`
- `domainId`
- `sentCount`
- `failedCount`
- `suppressedCount`
- `billableCount`
- `period`
- `createdAt`

Initial billing rule:

- Bill for emails accepted by SES.
- Do not bill suppressed recipients.
- Failed sends should be recorded but not billed unless pricing policy changes
  later.

## Domain Connection Flow

The customer-facing flow should feel similar to Resend.

### Step 1: User Adds Domain

User enters:

```txt
example.com
```

LetterStack creates a domain record with status `pending`.

### Step 2: LetterStack Creates SES Identity

Using LetterStack's AWS SES account, create an SES domain identity for
`example.com`.

SES returns DKIM records.

The app stores these records in the `domains` table.

### Step 3: Show DNS Records

LetterStack shows the user the required DNS records.

The user adds these records wherever their DNS is hosted:

- Cloudflare
- GoDaddy
- Namecheap
- Route 53
- Google Domains / Squarespace
- Any DNS provider

### Step 4: DKIM Records

SES Easy DKIM usually provides three CNAME records.

Example shape:

```txt
Type: CNAME
Name: token1._domainkey.example.com
Value: token1.dkim.amazonses.com

Type: CNAME
Name: token2._domainkey.example.com
Value: token2.dkim.amazonses.com

Type: CNAME
Name: token3._domainkey.example.com
Value: token3.dkim.amazonses.com
```

The exact values must come from SES.

### Step 5: Custom MAIL FROM

Use a subdomain like:

```txt
mail.example.com
```

or:

```txt
bounce.example.com
```

Required records:

```txt
Type: MX
Name: mail.example.com
Value: 10 feedback-smtp.<aws-region>.amazonses.com
```

```txt
Type: TXT
Name: mail.example.com
Value: v=spf1 include:amazonses.com ~all
```

This helps SPF alignment and improves deliverability.

### Step 6: DMARC

Ask users to add a DMARC record.

Start safely with:

```txt
Type: TXT
Name: _dmarc.example.com
Value: v=DMARC1; p=none; rua=mailto:dmarc@example.com
```

Later, advanced users can move to:

```txt
p=quarantine
```

or:

```txt
p=reject
```

Do not force strict DMARC in the first version because it can break existing
mail flows if the customer already sends email from other services.

### Step 7: Verification Polling

LetterStack should poll SES for identity verification status.

The UI should show:

- Pending DNS
- DKIM verified
- MAIL FROM verified
- Ready to send
- Failed / needs attention

DNS can take minutes and sometimes up to 72 hours.

### Step 8: Enable Sender Addresses

Once the domain is verified, users can create sender addresses:

```txt
newsletter@example.com
updates@example.com
events@example.com
```

A campaign can only send from a verified sender address under a verified
domain.

## Sending Flow

The multi-domain send flow should work like this:

1. User selects organization.
2. User creates or selects a campaign.
3. User selects a verified sender address.
4. App verifies that sender belongs to the organization.
5. App verifies that sender's domain is verified.
6. App compiles the `EmailDocument`.
7. App freezes HTML/text snapshot.
8. App freezes the audience.
9. App creates campaign recipient rows.
10. App enqueues QStash batches.
11. Worker checks idempotency.
12. Worker checks suppression.
13. Worker sends through SES.
14. Worker stores SES `MessageId`.
15. Worker marks sent/failed status.
16. SES/SNS webhook records delivery/bounce/complaint/open/click events.
17. Usage ledger is updated for billing.

## Send Authorization Rules

Before sending, enforce:

- Campaign belongs to current organization.
- Sender address belongs to current organization.
- Sender domain belongs to current organization.
- Sender domain status is `verified`.
- Sender address status is `verified` or `active`.
- User has permission to send for the organization.
- Audience belongs to the organization.
- HTML snapshot exists.
- Subject line exists.
- From email exists.
- Unsubscribe link exists.
- Campaign is not already sending or sent.

## SES Configuration

Use LetterStack's SES account.

For each verified customer domain:

- Create SES identity.
- Enable Easy DKIM.
- Configure MAIL FROM domain.
- Attach configuration set.
- Route events to SNS.
- SNS sends events to LetterStack webhook.

Use one SES account initially.

Do not use per-customer AWS accounts in v1.

## Event Handling

SES event webhook should handle:

- Delivery
- Bounce
- Complaint
- Open
- Click
- Reject
- Rendering Failure
- Send

Bounce and complaint handling:

- Record event.
- Add email to suppression.
- Mark campaign recipient as failed if applicable.
- Never send to globally suppressed emails again.

Webhook security:

- QStash workers already verify signatures.
- SES/SNS webhook must eventually verify SNS signatures before production
  multi-tenant use.

## Tracking Domain

Optional later feature.

Users may connect:

```txt
track.example.com
```

This allows open/click tracking links to use the customer's domain instead of
an Amazon tracking domain.

Do not block initial custom-domain sending on tracking-domain support.

## Billing Model

LetterStack sends through its own SES account and charges users.

Suggested first billing model:

- Charge per accepted SES send.
- Track usage per organization.
- Keep monthly usage ledger.
- Show sent volume in dashboard.
- Do not charge for suppressed recipients.
- Do not charge failed sends unless SES accepted the message.

Later billing options:

- Monthly included quota.
- Overage pricing.
- Per-domain pricing.
- Agency pricing.
- Dedicated IP surcharge.

## UI Pages Needed Later

### Organization Settings

Manage:

- Organization name
- Members
- Roles
- Billing
- Usage

### Domains Page

Manage:

- Add domain
- View DNS records
- Check verification
- Remove/disable domain
- View sender addresses

### Sender Addresses Page

Manage:

- Add sender email
- Set default sender
- Disable sender

### Send Settings

Campaign send screen should let the user select:

- Organization
- Sender address
- Audience/list
- Campaign/template

### Domain Verification Screen

Should show records in copyable rows:

- Type
- Host/name
- Value
- Status
- Copy button

## API Surfaces Needed Later

### Domains

```txt
POST /api/domains
GET /api/domains
GET /api/domains/:id
POST /api/domains/:id/check
DELETE /api/domains/:id
```

### Sender Addresses

```txt
POST /api/sender-addresses
GET /api/sender-addresses
PATCH /api/sender-addresses/:id
DELETE /api/sender-addresses/:id
```

### Campaign Sending

```txt
POST /api/campaigns/:id/send
GET /api/campaigns/:id/progress
```

Send endpoint must use campaign organization/domain/sender data, not global
`MAIL_FROM`.

## Migration Path From Current App

### Phase A: Add Organizations

- Add users and organizations.
- Scope campaigns to organization.
- Scope recipients to organization.
- Keep one default organization for existing data.

### Phase B: Add Domains

- Add domain table.
- Add sender address table.
- Keep current `MAIL_FROM` as default verified internal sender.
- Build domain UI, but do not require it for old test flow yet.

### Phase C: Connect SES Identity APIs

- Create SES domain identity from app.
- Store DKIM records.
- Add check-status endpoint.
- Display DNS records.

### Phase D: Enforce Verified Sender

- Campaigns must choose a sender address.
- Send path rejects unverified domains.
- Remove global `MAIL_FROM` dependency from product send path.

### Phase E: Usage and Billing

- Add usage ledger.
- Count billable sends.
- Add organization usage dashboard.

### Phase F: Harden Production

- SNS signature verification.
- Rate limits per organization.
- Abuse prevention.
- Bounce/complaint monitoring.
- Domain reputation monitoring.
- Admin dashboard.

## Important Product Constraints

- Do not build this before the first real CIBA send unless needed.
- Keep current email compiler as the only HTML path.
- Keep send snapshots frozen.
- Keep QStash idempotency.
- Never allow a user to send from a domain they do not own.
- Never allow unverified domains to send.
- Never bypass suppression checks.

## Typical DNS Explanation For Users

Plain-language explanation:

To send from your domain, LetterStack needs permission from your DNS provider.
We give you a few DNS records. You copy them into Cloudflare, GoDaddy,
Namecheap, Route 53, or wherever your domain DNS is managed.

Those records prove three things:

1. You own the domain.
2. LetterStack is allowed to send email for the domain.
3. Receiving inboxes can verify the email is legitimate.

After the records are added, DNS takes time to update. LetterStack keeps
checking until Amazon SES confirms the domain is ready.

## References

- AWS SES domain identities: https://docs.aws.amazon.com/ses/latest/dg/creating-identities.html
- AWS SES custom MAIL FROM: https://docs.aws.amazon.com/ses/latest/dg/mail-from.html
- AWS SES SPF: https://docs.aws.amazon.com/ses/latest/dg/send-email-authentication-spf.html
- AWS SES DMARC: https://docs.aws.amazon.com/ses/latest/dg/send-email-authentication-dmarc.html
- AWS SES custom tracking domains: https://docs.aws.amazon.com/ses/latest/dg/configure-custom-open-click-domains.html
- AWS SES event publishing with SNS: https://docs.aws.amazon.com/ses/latest/dg/event-publishing-add-event-destination-sns.html

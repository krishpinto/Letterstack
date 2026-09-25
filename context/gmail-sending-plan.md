# Gmail Sending — Plan

Status: **proposed, not implemented**. Written 2026-07-29.

Goal: let a workspace send from a connected Gmail mailbox as well as from a
verified SES domain. Turns LetterStack from "newsletter tool for orgs" into
"newsletter tool for orgs **plus** personal outreach / job applications from
your own inbox".

---

## 1. What exists today

- `/dashboard/domains` — one page. Left column adds + verifies SES domains,
  right column has a **dead placeholder card** ("Gmail integration",
  disabled button) at [page.tsx:506-539](app/dashboard/domains/page.tsx#L506-L539).
- Inner sidebar for the module is `DomainsSidebar` at
  [nav-sidebar.tsx:511-540](components/protected-shell/nav-sidebar.tsx#L511-L540)
  — a single nav item, "Connected domains".
- Sender rules live in [lib/send/sender-identity.ts](lib/send/sender-identity.ts):
  `isAllowedFromEmail(email, verifiedDomains)` allows only `MAIL_FROM` or a
  local part on a verified org domain.
- Every send goes through one function: `sendEmail()` in
  [lib/send/ses.ts](lib/send/ses.ts). Nothing else talks to a mail provider.
- `campaigns` stores `from_name` / `from_email` as free text with no record of
  *which* identity produced them.

So the whole feature is: a second transport behind `sendEmail`, a table to hold
mailbox credentials, and a real UI where the placeholder card is.

---

## 2. "Can't we just send Gmail addresses through our own SES?"

Asked and researched 2026-07-29. Short answer: **mechanically yes, and it's a
trap.** Worth writing down so it doesn't get re-proposed later.

SES does let you verify an individual *email address* identity — you can't
verify the `gmail.com` domain, but you can verify `someone@gmail.com`. AWS mails
a confirmation link, the user clicks it, and SES will then accept that address
in the `From:` header. So it looks like it works.

It breaks authentication in a way that **cannot be fixed by configuration**:

- DMARC passes only if the `From:` domain aligns with the SPF domain or the
  DKIM signing domain.
- Sent via SES, the Return-Path is an `amazonses.com` subdomain and DKIM signs
  as our domain. The `From:` domain would be `gmail.com`. Neither aligns.
- Fixing that means publishing a DKIM key in **gmail.com's DNS**. We will never
  control gmail.com's DNS. This is structural, not a settings problem.

What actually happens in the wild:

- gmail.com's live DMARC record is `v=DMARC1; p=none; sp=quarantine;` (verified
  by DNS lookup, 2026-07-29). So the *published* policy is `p=none` — a failure
  isn't formally mandated to be quarantined, which is why this trick appears to
  work when you test it once.
- But Google's sender guidelines name this exact pattern: *"Don't impersonate
  Gmail From: headers. Gmail will begin using a DMARC quarantine enforcement
  policy, and impersonating Gmail From: headers might impact your email
  delivery."* They define impersonation as "a sender sends a message with a
  @gmail address in the From: header but the message wasn't sent from a Gmail
  server" — precisely what we'd be doing.
- Google began ramping enforcement toward temporary and permanent rejections in
  November 2025. That is in the past.
- Independent of published policy, an unaligned `gmail.com` From is the single
  most-abused pattern in phishing, so filters weight it heavily. It fails worst
  exactly where it matters most — Gmail-to-Gmail — and recruiters overwhelmingly
  read mail on Gmail or Workspace.

Two more costs specific to us:

- **Shared reputation.** Our SES account sends every customer's newsletter. Spoof-shaped
  traffic driving complaints puts that account's reputation — and therefore
  real customer sending — at risk. SES suspends above 10% bounce / 0.5% complaint.
- The message shows a "via" line in Gmail's UI, never lands in the user's
  **Sent** folder, and replies don't thread with anything.

**Verdict: do not send `@gmail.com` From addresses through SES.** Not as a
fallback, not as a v1 shortcut.

---

## 3. The option space, and what to actually build

| | From address | DMARC | Inbox placement | In user's Sent | Cost to build |
|---|---|---|---|---|---|
| A. SES + verified Gmail address | their Gmail | **fails** | poor, degrading | no | low |
| B. SES from our domain + `Reply-To` | our domain | passes | excellent | no | **~an hour** |
| C. Gmail SMTP + App Password | their Gmail | passes | excellent | **yes** | moderate |
| D. Gmail API + OAuth | their Gmail | passes | excellent | yes | blocked, paid |

**A is out** (§2).

**B is nearly free and we should do it regardless.** Send from the verified
domain as today, set `Reply-To: user@gmail.com`, and use a human From name.
SES's `SendEmailCommand` already supports this via `ReplyToAddresses` — it is a
field addition in [lib/send/ses.ts](lib/send/ses.ts) plus a campaign column,
nothing more. Replies land in their Gmail. Fully aligned, best-in-class
deliverability. This improves existing newsletters too, and it gives the Gmail
feature a good fallback for anyone who won't set up an app password.

**B is not a substitute for C, though**, and the reason is specific to the job
-application case: that's *one email to one person*, and the point of sending it
from your own Gmail is that it sits in your Sent folder and the recruiter's
reply threads into that conversation in your inbox. With B, the reply arrives
but the original isn't in Sent, so there's no thread and no record. For a
newsletter that's irrelevant; for personal outreach it's the whole thing.

**C is the real feature.** Authenticating as the user to `smtp.gmail.com:587`
means *Google* is the sender — DKIM signed by google.com, perfect alignment,
nothing spoofed, and Gmail automatically files the message in Sent. Verified
still current for 2026: App Passwords remain the only password-based SMTP auth
for personal Gmail (2FA required first), `smtp.gmail.com` on 587/STARTTLS.
Google fully removed "Less secure app access" on 1 May 2025, so app passwords
are the supported path, not a legacy hack.

**D is the same result as C with a nicer connect flow**, blocked on the
`gmail.send` restricted scope, which needs Google app verification plus a paid
annual third-party CASA assessment. This project already parked plain Google
sign-in over exactly that cost — `GOOGLE_AUTH_ENABLED = false` in
[lib/auth.ts:12](lib/auth.ts#L12). A restricted scope is strictly more expensive
than the sign-in scopes already judged not worth paying for.

**Recommendation: ship B now, then C, design for D.** The mailbox row carries an
`auth_type` column from day one and transport resolves through an interface, so
D is later a new branch plus a new connect dialog — not a rewrite. Do D whenever
Google verification gets paid for, since that same spend un-blocks Google
sign-in.

---

## 4. Hard constraints Gmail brings (design around these, don't discover them later)

1. **Volume caps.** Consumer Gmail ≈ 500 recipients/day; Workspace ≈ 2,000/day.
   A Gmail sender can never run a 3,000-recipient newsletter. The UI must
   refuse rather than half-send: block the send if audience size > remaining
   daily quota, and show a quota meter on the mailbox card.
2. **No delivery events.** SES events arrive via configuration set → SNS →
   `/api/webhooks/ses`. Gmail has no equivalent — bounces come back as a mail
   in the *user's* inbox, invisible to us. So for a Gmail campaign there is no
   delivered/bounced/complained data and no SES open/click tracking. Analytics
   for these campaigns must be visibly degraded ("sent" count only), not
   silently zero. Do **not** build a custom pixel for v1.
3. **Rate limiting.** Gmail SMTP tolerates roughly 1 message/second per account
   and dislikes parallel connections. The SES batch math (50/batch, 4s stagger)
   is wrong here — Gmail needs small batches and serial execution per mailbox.
4. **Suppression and unsubscribe still apply** — those are our own tables and
   our own signed URLs, entirely transport-independent. They keep working.
5. **Personal mail should not carry an unsubscribe footer.** A job application
   ending in "Unsubscribe from LetterStack" is a bad look and isn't legally
   required (CAN-SPAM covers commercial mail). See §8.

---

## 5. Sidebar and route restructure

The module is no longer about domains. Rename it **Senders**, with
`/dashboard/domains` kept as a redirect so nothing breaks.

```
/dashboard/senders                → overview: every way this workspace can send
/dashboard/senders/domains        → today's domains page, unchanged logic
/dashboard/senders/gmail          → Gmail mailboxes (list + connect)
/dashboard/senders/shared         → the shared LetterStack address, read-only
```

New inner sidebar (replaces `DomainsSidebar`):

```
Senders                                    [+]
  Overview                    (SendIcon)

  DOMAINS
    Connected domains         (GlobeIcon)      · badge: verified count
    <domain>.com              (per verified domain, deep link)

  MAILBOXES
    Gmail accounts            (MailIcon)       · badge: connected count
    Connect a mailbox         (dashed quick-add → opens dialog)

  SHARED
    LetterStack address       (MailCheckIcon)
```

Uses the existing `ModuleShell` / `NavItem` / `SectionHeader` / `QUICK_ADD_CLASS`
primitives already in that file — the collapsible-section pattern from
`CampaignsSidebar` transfers directly.

Files touched by the rename: `components/protected-shell/nav-sidebar.tsx`
(module map + new sidebar), `components/protected-shell/icon-rail.tsx`
(label/href), `components/app-sidebar.tsx` (`manageNav`),
`components/dashboard-shell.tsx`, `components/protected-shell/content-header.tsx`,
plus moving `app/dashboard/domains/page.tsx` and adding a redirect stub.

---

## 6. Data model

New table, deliberately named for the general case rather than Gmail:

```ts
export const connectedMailboxes = pgTable("connected_mailboxes", {
  id: uuid().defaultRandom().primaryKey(),
  organizationId: uuid().notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId:         uuid().notNull().references(() => users.id, { onDelete: "cascade" }),
  provider:       text().notNull().default("gmail"),        // future: outlook
  authType:       text().notNull(),                          // "app_password" | "oauth"
  email:          text().notNull(),
  displayName:    text(),
  // AES-256-GCM. Never leaves the server, never in any API response.
  secretCiphertext: text().notNull(),
  secretIv:         text().notNull(),
  secretTag:        text().notNull(),
  dailyLimit:     integer().notNull().default(450),          // headroom under Gmail's 500
  sentToday:      integer().notNull().default(0),
  quotaResetAt:   timestamp().notNull(),
  status:         text().notNull().default("active"),        // active | error | revoked
  lastError:      text(),
  lastVerifiedAt: timestamp(),
  createdAt:      timestamp().defaultNow().notNull(),
}, (t) => [unique("connected_mailboxes_org_email_unq").on(t.organizationId, t.email)]);
```

`campaigns` gains two columns so the worker knows what it's sending through,
frozen at send time next to `html_snapshot`:

```ts
senderType: text().notNull().default("shared"),   // shared | domain | mailbox
mailboxId:  uuid().references(() => connectedMailboxes.id, { onDelete: "set null" }),
mailingType: text().notNull().default("bulk"),    // bulk | personal  (see §7)
```

Encryption helper — new `lib/crypto/secret-box.ts`, AES-256-GCM, key from a new
`MAILBOX_ENCRYPTION_KEY` env var (32 bytes, base64). Model it on the existing
HMAC helper style in [lib/email/unsubscribe.ts](lib/email/unsubscribe.ts).
Refuse to start the connect flow if the key is missing rather than silently
storing plaintext.

---

## 7. Send path

Introduce a transport seam. `lib/send/ses.ts` stays exactly as it is.

```
lib/send/transport.ts     MailTransport interface + resolveTransport(sender)
lib/send/gmail.ts         MIME builder + nodemailer SMTP send (new dep: nodemailer)
lib/send/ses.ts           unchanged
```

`FrozenContent` in [lib/send/send-campaign.ts:17](lib/send/send-campaign.ts#L17)
grows `senderType` and `mailboxId`; `sendCampaignBatch` resolves the transport
once per batch instead of importing `sendEmail` directly. Everything else in
that file — suppression recheck, unsubscribe personalization, per-recipient
ledger marking, idempotency — is transport-agnostic and does not change. That
is the whole point of the seam.

Batching for a mailbox sender: `BATCH_SIZE = 10`, serial within the batch with
a ~1s gap, and batches for the same mailbox published with a stagger rather
than all at once. Quota is decremented per successful send, with
`quota_reset_at` rolling forward daily.

`isAllowedFromEmail` gains a third case: an address is allowed if it exactly
equals the `email` of an `active` mailbox belonging to this org. No local-part
substitution — you send from the exact address you connected.

Validation before a Gmail send: mailbox `status = active`, credential verified
within N days, audience size ≤ remaining quota, and (for `personal`) audience
≤ 50.

### Connect flow (app password)

1. `POST /api/senders/mailboxes` — `{ email, displayName, appPassword }`.
2. Server opens an SMTP connection and calls `transporter.verify()`. This both
   validates the credential *and* proves the user controls that mailbox — no
   separate ownership check needed.
3. On success, encrypt and store; optionally send a confirmation mail to the
   address itself so the user sees it work.
4. `GET` returns mailboxes **without** any secret field, ever.
5. `DELETE` hard-deletes the row and tells the user to also revoke the app
   password in their Google account.

Rate-limit connect attempts — this endpoint accepts credentials.

---

## 8. Product detail: bulk vs personal

The job-application use case is not just "same product, different transport".
A campaign sent to 20 hiring managers should not carry an unsubscribe footer, a
List-Unsubscribe header, or newsletter framing.

Add `mailingType` on the campaign, chosen when the sender is a mailbox:

| | bulk | personal |
|---|---|---|
| Unsubscribe footer | required | omitted |
| `List-Unsubscribe` headers | set | omitted |
| Audience cap | quota | 50 |
| Suppression check | yes | yes |

The cap on `personal` is what stops it becoming a no-unsubscribe bulk-mail
loophole. Suppression stays enforced in both modes, always.

---

## 9. Build order

Each step is independently shippable and leaves the app working.

0. **`Reply-To` support** (option B). Add `ReplyToAddresses` to
   [lib/send/ses.ts](lib/send/ses.ts), a `reply_to` column on campaigns, and a
   field in the From step of the campaign editor. Roughly an hour, benefits
   every existing newsletter, and gives step 3+ a fallback for users who won't
   set up an app password. Do this first regardless of what else gets built.
1. **Sidebar + routes.** Rename module to Senders, split the existing page into
   `/senders/domains` + `/senders/shared`, add a real (still empty)
   `/senders/gmail` page, redirect the old URL. Delete the placeholder card.
   *No backend work — this is the visible half of what was asked for.*
2. **Schema + crypto.** `connected_mailboxes` table, migration, campaign
   columns, `lib/crypto/secret-box.ts`, `MAILBOX_ENCRYPTION_KEY`.
3. **Connect flow.** `nodemailer` dep, `lib/send/gmail.ts` MIME + verify,
   `/api/senders/mailboxes` CRUD, the connect dialog, mailbox cards with quota
   meter, "Send test email", disconnect.
4. **Send integration.** `lib/send/transport.ts`, `FrozenContent` extension,
   worker branch, Gmail batch pacing, `isAllowedFromEmail` third case,
   pre-send validation.
5. **Campaign UI.** Gmail mailboxes as a third option in the sender picker at
   [campaign-detail.tsx:1028](app/dashboard/campaigns/[id]/campaign-detail.tsx#L1028),
   bulk/personal toggle, and an honest "no delivery tracking on Gmail sends"
   note on the analytics view.
6. **Later, conditional on paying for Google verification:** OAuth connect as a
   second `authType`, alongside re-enabling `GOOGLE_AUTH_ENABLED`.

Steps 1–2 are safe to do in either order. Step 0 is the only one before step 4
that touches the live send path, and it's additive — an optional header on an
existing SES call. Steps 1–3 add no new way to send mail at all, so nothing
there can break the existing SES path.

---

## 10. Open questions

- Is a mailbox owned by the **organization** (any member can send from it) or by
  the **user** who connected it? Plan above says org-scoped with a `user_id`
  recorded, matching how domains work — but personal mailboxes arguably
  shouldn't be usable by teammates.
- Does the Gmail use case want per-recipient personalization beyond
  `{{name}}`? Job applications usually need a custom paragraph per recipient,
  which is a bigger editor question, not a sending one.
- Should `personal` campaigns skip open/click tracking entirely for
  credibility? (Currently moot — Gmail sends have no tracking anyway.)

---

## Sources (§2–§3 research, 2026-07-29)

- DMARC record for gmail.com — live DNS TXT lookup of `_dmarc.gmail.com`
  against 8.8.8.8: `v=DMARC1; p=none; sp=quarantine; rua=mailto:mailauth-reports@google.com`
- [Email sender guidelines — Gmail Help](https://support.google.com/mail/answer/81126?hl=en)
  ("Don't impersonate Gmail From: headers")
- [Email sender guidelines FAQ — Gmail Help](https://support.google.com/a/answer/14229414?hl=en)
- [Verified identities in Amazon SES](https://docs.aws.amazon.com/ses/latest/dg/verify-addresses-and-domains.html)
  (email-address identities; gmail.com domain cannot be verified)
- [Complying with DMARC in Amazon SES](https://docs.aws.amazon.com/ses/latest/dg/send-email-authentication-dmarc.html)
- [Gmail SMTP settings 2026](https://cli.nylas.com/guides/gmail-smtp-settings)
  and [Gmail app password requirements](https://smtpedia.com/gmail-email-settings-pop3-imap-smtp/)
  (App Passwords still the only password-based SMTP auth; LSA removed 1 May 2025)

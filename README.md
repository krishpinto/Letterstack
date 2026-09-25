# LetterStack

Email campaign platform for organisations that send recurring newsletters.
A block-based canvas editor compiles to email-safe HTML, which goes out
through Amazon SES from the customer's own verified domain.

**Live at [letterstack.site](https://letterstack.site)**

Built by [@krishpinto](https://github.com/krishpinto). It is a real product
with real users, not a tutorial project — the decisions below exist because
sending other people's mail punishes you for getting them wrong.

---

## Why it exists

The first user was a nonprofit sending roughly 3,000 emails a month. They had
given up on their existing tool's editor and were exporting flat images out of
Canva and pasting them into an email — which meant no selectable text, no
working links, unreadable on a phone, and a spam-filter magnet.

So the product is shaped around that: a real editor that produces real
responsive HTML, priced on SES rates, sending from your own domain, with no
lock-in. It is deliberately not "a better Mailchimp."

---

## Architecture

![LetterStack architecture](docs/architecture.png)

The send path is the interesting half:

1. **Editor → `EmailDocument`.** A JSON document is the single source of
   truth. The canvas writes to it; nothing else does.
2. **Compiler.** [`compileEmailDocument()`](lib/email/compiler.ts) is the only
   thing in the codebase that produces HTML — for preview and for sending
   alike, so the two can never drift. Output is tables and inline styles: no
   flexbox, no grid, no CSS variables, because Outlook renders through Word's
   HTML engine.
3. **Freeze.** On send, the compiled HTML and its plain-text alternative are
   written to the campaign row and never read from live state again.
4. **Fan out.** The audience is chunked 50 per batch and published to
   [Upstash QStash](https://upstash.com/docs/qstash), each batch delayed 4s
   further than the last. 3,000 recipients is 60 batches, about four minutes.
5. **Workers.** Each batch lands on a serverless worker that verifies the
   QStash signature, re-reads which of its recipients are *still pending*, and
   sends one SES call per address.
6. **Feedback.** An SES configuration set publishes delivery, bounce,
   complaint, open and click events to SNS, which posts them to
   [`/api/webhooks/ses`](app/api/webhooks/ses/route.ts). Bounces and
   complaints write to a global suppression table.

---

## Engineering notes

The parts that took thought, and why they are the way they are.

**Idempotency is the whole ballgame.** QStash retries on failure, so a worker
can and will run twice with the same payload. Every worker re-reads pending
status before sending, so a retry after a partial success re-sends to nobody.
There is no exactly-once delivery here — there is at-least-once delivery plus
an idempotency check at the point of effect, which is the achievable thing.

**The snapshot is frozen at send time.** A 3,000-recipient send takes about
four minutes. Without a frozen copy, an edit made mid-send would mean
recipient 1 and recipient 2,000 received different emails, and there would be
no record of what actually went out.

**Quota is reserved atomically, all or nothing.** A guarded `UPDATE` reserves
the full audience up front, so a campaign is never cut off partway through and
two concurrent "Send now" clicks cannot both pass the check.

**Suppression is global, not per campaign.** SES suspends an account above 10%
bounce or 0.5% complaint, and those thresholds are account-wide. One customer's
stale list would take down sending for everyone, so hard bounces and complaints
are suppressed across every campaign and every list import automatically.

**Correlation rides on SES message tags.** Each send is tagged with its
campaign id. SES echoes the tag back in the SNS event, so a bounce arriving
forty minutes later attributes itself without a `MessageId` lookup table.

**One SES call per recipient, not one BCC.** Each recipient gets their own
one-click unsubscribe token, failures are attributable to a single address
instead of poisoning a batch, and bulk BCC is a spam signal.

**Opens are estimates; deliveries are facts.** Apple Mail Privacy Protection
pre-fetches every image, manufacturing an open per Apple Mail recipient. Gmail
proxies and caches images. The dashboard does not present the two as equally
reliable.

**DMARC alignment is a real constraint, learned the hard way.** Sending from a
branded subdomain failed DMARC and Gmail dropped the mail outright: the DKIM
signature aligned to the parent domain while the `From:` header said subdomain.
Sends now go from the parent domain until per-subdomain DKIM and SPF are set up.

**Untrusted HTML renders sandboxed.** The admin campaign preview renders a
customer's own HTML in an `iframe` with `sandbox=""` — no `allow-scripts`. It
only ever needs to display, never to execute.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 |
| Database | Neon Postgres + Drizzle ORM |
| Queue | Upstash QStash |
| Email | Amazon SES via AWS SDK v3 (SESv2), `ap-south-1` |
| Auth | NextAuth — credentials (bcrypt) + Google OAuth |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Image CDN | UploadThing |
| Parsing | SheetJS (xlsx), PapaParse (csv) |
| Payments | Razorpay |
| Hosting | Vercel |

---

## Repo layout

```
app/              pages + API routes (editor, trigger, workers, webhook, dashboard)
components/editor/ editor UI, split by concern — canvas, inspector, preview
lib/email/        document.ts + compiler.ts — the shared core
lib/send/         batching, SES transport, Gmail transport, idempotency
lib/import/       file parsing, header mapping, validation, dedupe
db/               Drizzle schema and migrations
context/          architecture and planning notes
```

Module boundaries are treated as lint: `lib/*` never imports from `app/` or
`components/`, and `lib/email/` is the only module the editor and the send path
share.

---

## Running locally

This is a real deployment rather than a self-contained demo, so it wants live
services. You will need Postgres (Neon or any Postgres), an SES account with a
verified sending domain, and a QStash token.

```bash
npm install
cp .env.example .env.local     # then fill it in
npm run qstash:dev             # local QStash, in a second terminal
npm run dev
```

`npm run typecheck` and `npm run lint` both run in CI on every push and pull
request.

The editor, dashboard and import flow work against Postgres alone. Sending
itself will error without SES credentials and a QStash token — it does not
degrade gracefully, it tells you what is missing.

---

## Status

In public beta. Open signup, four plan tiers, and real organisations sending
real campaigns. Known gaps are tracked honestly rather than hidden: there is no
test suite yet, the dashboard shell has no mobile layout, and block reordering
is arrow-buttons-only pending drag and drop.

---

## License

[Apache 2.0](LICENSE). You are free to use, modify and self-host this.
"LetterStack" and its logo are trademarks and are not granted by the licence —
see section 6 and [NOTICE](NOTICE).

If you would rather not run your own SES, DKIM and queue infrastructure,
[letterstack.site](https://letterstack.site) is the hosted version.
